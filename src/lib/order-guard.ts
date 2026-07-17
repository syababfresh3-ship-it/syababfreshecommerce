// ============================================================
// order-guard — pertahanan anti-bot untuk endpoint cipta-order.
// Tiga lapisan (lihat docs/runbook-anti-bot.md):
//   1. Burst gate  — rateLimit() in-memory (di route, bukan sini)
//   2. Had global  — checkGuestOrderFlood/checkMemberOrderIpFlood (DB,
//      SATU query; kiraan dibuat dalam JS supaya padanan telefon guna
//      normalizePhone — elak bypass format — & elak inject filter PostgREST)
//   3. Honeypot    — isHoneypotFilled; bot auto-isi field tersembunyi
//      'website' → route balas fake-200 tanpa cipta apa-apa
// ============================================================
import { normalizePhone } from "@/lib/phone";
import { clientIp } from "@/lib/rate-limit";

// Had sejam. IP sengaja longgar (20) — telco MY guna CGNAT, ramai customer
// sah kongsi satu IP awam lepas blast. Telefon/email penapis tepat per-individu.
export const MAX_ORDERS_PER_IP_HOUR = 20;
export const MAX_ORDERS_PER_PHONE_HOUR = 3;
export const MAX_ORDERS_PER_EMAIL_HOUR = 3;

export const FLOOD_ERROR = "Terlalu banyak pesanan dalam masa singkat. Sila cuba sebentar lagi.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

// IP pemanggil yang disahkan bentuknya. null = tak boleh percaya (dev/proxy
// pelik) → dimensi IP di-skip, dimensi telefon/email kekal berfungsi.
export function safeClientIp(req: Request): string | null {
  const ip = clientIp(req);
  return /^[0-9a-fA-F:.]+$/.test(ip) && ip !== "unknown" ? ip : null;
}

// Bot auto-isi semua field — manusia tak nampak field ni langsung.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isHoneypotFilled(body: any): boolean {
  return typeof body?.website === "string" && body.website.trim() !== "";
}

// Nombor order palsu yang munasabah untuk balasan honeypot (tanpa DB) —
// bot tak dapat sinyal ditolak, tak belajar adapt.
export function fakeOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `LP-${ymd}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

// Had global order guest (merentas instance): satu query ambil row sejam
// terakhir, kira padanan dalam JS. Jadual kecil (puluhan row/hari) → murah.
export async function checkGuestOrderFlood(
  admin: SB,
  ip: string | null,
  phone: string,
  email: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { data } = await admin
    .from("lp_guest_orders")
    .select("client_ip, phone, email")
    .gte("created_at", hourAgo)
    .limit(500);
  const rows = (data ?? []) as { client_ip: string | null; phone: string | null; email: string | null }[];

  const normPhone = normalizePhone(phone);
  const normEmail = (email ?? "").trim().toLowerCase();

  let byIp = 0, byPhone = 0, byEmail = 0;
  for (const r of rows) {
    if (ip && r.client_ip === ip) byIp++;
    if (normPhone && normalizePhone(r.phone) === normPhone) byPhone++;
    if (normEmail && (r.email ?? "").trim().toLowerCase() === normEmail) byEmail++;
  }

  if (byIp >= MAX_ORDERS_PER_IP_HOUR || byPhone >= MAX_ORDERS_PER_PHONE_HOUR || byEmail >= MAX_ORDERS_PER_EMAIL_HOUR) {
    console.warn(`[order-guard] flood block ip=${ip} byIp=${byIp} byPhone=${byPhone} byEmail=${byEmail}`);
    return { ok: false, error: FLOOD_ERROR };
  }
  return { ok: true };
}

// Had IP untuk checkout member — tutup bypass rotate-signup (had sedia ada
// hanya per-user). Head count sahaja, murah.
export async function checkMemberOrderIpFlood(admin: SB, ip: string | null): Promise<boolean> {
  if (!ip) return true;
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("client_ip", ip)
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_ORDERS_PER_IP_HOUR) {
    console.warn(`[order-guard] member flood block ip=${ip} count=${count}`);
    return false;
  }
  return true;
}
