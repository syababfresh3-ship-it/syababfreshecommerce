// ============================================================
// external-sync — logik sepunya sync pembeli channel luar (TikTok) dari ops app
// (manage.syababfresh.my/api/sync) → external_customers (agregat penuh) + tag
// wa_contacts (tiktok/website). Diguna oleh /api/admin/external-customers/sync
// (manual, admin) & /api/cron/external-sync (auto, cron-job.org). One-way, additive.
// ============================================================

import { fetchAll } from "@/lib/supabase/fetch-all";

const OPS_URL = process.env.OPS_APP_URL ?? "https://manage.syababfresh.my";
const SYNC_SECRET = process.env.SYNC_SECRET ?? "";

type OpsCustomer = { phone: string; name: string; order_count: number; total_spend: number; last_order_at: string; orders?: { id: string }[] };
type Agg = { phone: string; name: string; order_count: number; total_spend: number; last_order_at: string; hasNum: boolean; hasAlpha: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

// Bersihkan nombor ke 60XXXXXXXXX (betulkan pepijat ops: '60'+'60xxx', '+60', '0xxx').
function cleanPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("6060")) d = d.slice(2);
  if (d.startsWith("0")) d = "60" + d.slice(1);
  else if (!d.startsWith("60")) d = "60" + d;
  return d;
}

export interface SyncResult {
  ok: boolean;
  synced?: number;      // baris yang benar-benar dihantar ke DB
  contacts?: number;
  total?: number;       // jumlah pelanggan dari ops
  unchanged?: number;   // dilangkau kerana tiada perubahan
  ms?: number;
  dry?: boolean;
  full?: boolean;
  error?: string;
  status?: number;
}

// opts.full — abaikan pembandingan dan hantar SEMUA baris (pemulihan penuh).
// Cron guna mod tokokan; butang sync manual di admin guna mod penuh supaya ada
// jalan keluar kalau tag wa_contacts atau baris pernah terlepas.
export async function syncExternalCustomers(sb: SB, opts: { dry?: boolean; full?: boolean } = {}): Promise<SyncResult> {
  const t0 = Date.now();
  if (!SYNC_SECRET) return { ok: false, error: "SYNC_SECRET tidak diset.", status: 503 };

  let data: { customers?: OpsCustomer[] } | null = null;
  try {
    const res = await fetch(`${OPS_URL}/api/sync`, { headers: { "x-sync-secret": SYNC_SECRET }, cache: "no-store" });
    data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: `Ops app error: ${res.status}`, status: 502 };
  } catch (err) {
    return { ok: false, error: `Gagal hubungi ops: ${(err as Error).message}`, status: 503 };
  }

  // Semua customer — agregat ops = nilai+kekerapan PENUH (semua channel). Klasifikasi
  // channel untuk TAG sahaja (numerik=tiktok, huruf=website).
  const cleaned = (data?.customers ?? [])
    .map((c) => ({
      phone: cleanPhone(c.phone),
      name: c.name,
      order_count: Number(c.order_count || 0),
      total_spend: Number(c.total_spend || 0),
      last_order_at: c.last_order_at,
      hasNum: (c.orders ?? []).some((o) => /^\d+$/.test(String(o.id ?? "").trim())),
      hasAlpha: (c.orders ?? []).some((o) => /[a-zA-Z]/.test(String(o.id ?? ""))),
    }))
    .filter((c) => c.phone.replace(/\D/g, "").length >= 10);

  const merged = new Map<string, Agg>();
  for (const c of cleaned) {
    const e = merged.get(c.phone);
    if (e) {
      e.order_count += c.order_count;
      e.total_spend += c.total_spend;
      if (c.last_order_at && (!e.last_order_at || c.last_order_at > e.last_order_at)) e.last_order_at = c.last_order_at;
      if (c.name) e.name = c.name;
      e.hasNum = e.hasNum || c.hasNum;
      e.hasAlpha = e.hasAlpha || c.hasAlpha;
    } else {
      merged.set(c.phone, { ...c });
    }
  }
  const customers = [...merged.values()];
  if (customers.length === 0) return { ok: true, synced: 0, contacts: 0, total: 0, unchanged: 0, ms: Date.now() - t0 };

  const CHUNK = 500;

  // ── Hantar yang BERUBAH sahaja ────────────────────────────────────────────
  // Dulu semua ~38k baris dihantar setiap kali (78 panggilan RPC + 150 lagi untuk
  // tag) — bersama fetch ops yang ambil ~40s, invocation tak pernah habis dan
  // heartbeat tak pernah dicop. Agregat ops jarang berubah antara hari, jadi kita
  // baca keadaan semasa dahulu dan langkau baris yang serupa.
  type Existing = { phone: string; name: string | null; order_count: number; total_spend: number; last_order_at: string | null };
  const existingRows = await fetchAll<Existing>(
    (from, to) => sb.from("external_customers")
      .select("phone, name, order_count, total_spend, last_order_at")
      .eq("channel", "ops")
      .order("phone")
      .range(from, to),
    "external-sync:existing",
  );
  const existing = new Map(existingRows.map((r) => [r.phone, r]));

  const same = (a: Agg, b: Existing) =>
    (a.name || null) === (b.name || null) &&
    Number(a.order_count) === Number(b.order_count) &&
    Math.abs(Number(a.total_spend) - Number(b.total_spend)) < 0.005 &&
    new Date(a.last_order_at ?? 0).getTime() === new Date(b.last_order_at ?? 0).getTime();

  const changed = opts.full ? customers : customers.filter((c) => {
    const e = existing.get(c.phone);
    return !e || !same(c, e);
  });
  const unchanged = customers.length - changed.length;

  if (opts.dry) {
    return { ok: true, dry: true, synced: 0, contacts: 0, total: customers.length, unchanged, full: !!opts.full, ms: Date.now() - t0 };
  }
  if (changed.length === 0) {
    return { ok: true, synced: 0, contacts: 0, total: customers.length, unchanged, ms: Date.now() - t0 };
  }

  // 1) external_customers — agregat PENUH, satu baris per phone (channel='ops').
  let synced = 0;
  for (let i = 0; i < changed.length; i += CHUNK) {
    const { data: n, error } = await sb.rpc("upsert_external_customers", { p_rows: changed.slice(i, i + CHUNK), p_channel: "ops" });
    if (error) return { ok: false, error: error.message, status: 500 };
    synced += Number(n ?? 0);
  }

  // 2) wa_contacts — tag 'tiktok' (ada order tiktok) / 'website'. Best-effort.
  //    Hanya pelanggan yang berubah — tag untuk yang lain sudah dipasang run lepas.
  let contacts = 0;
  const tagSets: [string, { wa_id: string; name: string }[]][] = [
    ["tiktok", changed.filter((c) => c.hasNum).map((c) => ({ wa_id: c.phone, name: c.name }))],
    ["website", changed.filter((c) => c.hasAlpha).map((c) => ({ wa_id: c.phone, name: c.name }))],
  ];
  try {
    for (const [tag, rows] of tagSets) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { data: n } = await sb.rpc("import_wa_contacts", { p_rows: rows.slice(i, i + CHUNK), p_tag: tag });
        contacts += Number(n ?? 0);
      }
    }
  } catch { /* abaikan */ }

  return { ok: true, synced, contacts, total: customers.length, unchanged, ms: Date.now() - t0 };
}
