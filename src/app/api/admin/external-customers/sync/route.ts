// ============================================================
// api/admin/external-customers/sync — tarik pembeli channel luar (TikTok) dari ops
// app (manage.syababfresh.my/api/sync) → simpan agregat ke external_customers +
// (best-effort) jadikan CRM contact (tag channel). ONE-WAY, additive.
// TIDAK menyentuh /api/admin/tiktok-sync sedia ada (viewer).
// ============================================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OPS_URL = process.env.OPS_APP_URL ?? "https://manage.syababfresh.my";
const SYNC_SECRET = process.env.SYNC_SECRET ?? "";

async function auth() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, sb: null };
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { user: null, sb: null };
  return { user, sb };
}

type OpsCustomer = { phone: string; name: string; order_count: number; total_spend: number; last_order_at: string; orders?: { id: string }[] };
type Agg = { phone: string; name: string; order_count: number; total_spend: number; last_order_at: string; hasNum: boolean; hasAlpha: boolean };

// Bersihkan nombor ke format 60XXXXXXXXX (betulkan pepijat ops: '60'+'60xxx', '+60', '0xxx').
function cleanPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("6060")) d = d.slice(2);        // ops bug: 60 + 60xxx
  if (d.startsWith("0")) d = "60" + d.slice(1);     // 01xxx → 601xxx
  else if (!d.startsWith("60")) d = "60" + d;       // 1xxx → 601xxx
  return d;
}

export async function POST() {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!SYNC_SECRET) return NextResponse.json({ error: "SYNC_SECRET tidak diset." }, { status: 503 });

  // Tarik dari ops (sumber kebenaran).
  let data: { customers?: OpsCustomer[] } | null = null;
  try {
    const res = await fetch(`${OPS_URL}/api/sync`, { headers: { "x-sync-secret": SYNC_SECRET }, cache: "no-store" });
    data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: `Ops app error: ${res.status}` }, { status: 502 });
  } catch (err) {
    return NextResponse.json({ error: `Gagal hubungi ops: ${(err as Error).message}` }, { status: 503 });
  }
  // Semua customer — agregat ops = nilai+kekerapan PENUH (semua channel). Klasifikasi
  // channel untuk TAG sahaja (numerik=tiktok, huruf=website, campur=both).
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

  // Dedupe + merge ikut phone bersih (elak ralat ON CONFLICT affect row 2x).
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
  if (customers.length === 0) return NextResponse.json({ ok: true, synced: 0, contacts: 0, total: 0 });

  const CHUNK = 500;

  // 1) external_customers — agregat PENUH semua channel, satu baris per phone (channel='ops').
  let synced = 0;
  for (let i = 0; i < customers.length; i += CHUNK) {
    const { data: n, error } = await sb.rpc("upsert_external_customers", { p_rows: customers.slice(i, i + CHUNK), p_channel: "ops" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    synced += Number(n ?? 0);
  }

  // 2) wa_contacts — tag 'tiktok' (ada order tiktok) / 'website' (ada order website).
  // Mixed buyer dapat KEDUA-DUA tag → muncul dalam segment masing-masing. Best-effort.
  let contacts = 0;
  const tagSets: [string, { wa_id: string; name: string }[]][] = [
    ["tiktok", customers.filter((c) => c.hasNum).map((c) => ({ wa_id: c.phone, name: c.name }))],
    ["website", customers.filter((c) => c.hasAlpha).map((c) => ({ wa_id: c.phone, name: c.name }))],
  ];
  try {
    for (const [tag, rows] of tagSets) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { data: n } = await sb.rpc("import_wa_contacts", { p_rows: rows.slice(i, i + CHUNK), p_tag: tag });
        contacts += Number(n ?? 0);
      }
    }
  } catch { /* abaikan — external_customers tetap tersimpan */ }

  return NextResponse.json({ ok: true, synced, contacts, total: customers.length });
}
