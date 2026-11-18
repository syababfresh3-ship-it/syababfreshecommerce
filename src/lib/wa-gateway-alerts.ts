// ============================================================
// wa-gateway-alerts — amaran bila nombor WhatsApp gateway putus / dilog keluar / pulih.
// Dipanggil oleh webhook gateway (peristiwa `session`) dan cron wa-gateway-health.
// Saluran: emel admin (ADMIN_EMAIL) + push admin. Dedup melalui app_settings
// (kunci `wa_gateway_alert:<id>`): hantar bila keadaan BERUBAH, ulang setiap 6 jam
// selagi masih bermasalah, dan satu notis "pulih" bila kembali connected.
// ============================================================
import { sendAdminEmail } from "@/lib/zeptomail";
import { sendAdminPush } from "@/lib/push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type GatewayState = "ok" | "down" | "logged_out" | "unreachable";
interface Stored { state: GatewayState; at: string; notified_at?: string }

const REPEAT_MS = 6 * 60 * 60 * 1000;
const keyFor = (id: string) => `wa_gateway_alert:${id.replace(/[^A-Za-z0-9_:-]/g, "")}`;

async function readState(sb: SB, id: string): Promise<Stored | null> {
  const { data } = await sb.from("app_settings").select("value").eq("key", keyFor(id)).maybeSingle();
  if (!data?.value) return null;
  try { return JSON.parse(data.value as string) as Stored; } catch { return null; }
}
async function writeState(sb: SB, id: string, st: Stored) {
  await sb.from("app_settings").upsert({ key: keyFor(id), value: JSON.stringify(st) }, { onConflict: "key" });
}

const LABEL: Record<GatewayState, string> = {
  ok: "pulih (connected)",
  down: "PUTUS (disconnected)",
  logged_out: "DILOG KELUAR — perlu imbas QR semula",
  unreachable: "gateway tidak dapat dihubungi",
};

/**
 * Nilai keadaan semasa satu id (session atau 'gateway') dan hantar amaran bila perlu.
 * Pulang true jika notis dihantar.
 */
export async function reportGatewayState(
  sb: SB,
  id: string,
  state: GatewayState,
  detail: { label?: string | null; phone?: string | null; reason?: string | null; since?: string | null } = {},
): Promise<boolean> {
  const prev = await readState(sb, id);
  const now = new Date();
  const changed = !prev || prev.state !== state;
  const repeatDue = !!prev && prev.state === state && state !== "ok"
    && (!prev.notified_at || now.getTime() - new Date(prev.notified_at).getTime() >= REPEAT_MS);

  // "ok" hanya bernilai dihantar bila sebelum ini bermasalah (pulih); keadaan ok→ok tak perlu simpan semula.
  if (state === "ok" && (!prev || prev.state === "ok")) {
    if (!prev) await writeState(sb, id, { state, at: now.toISOString() });
    return false;
  }
  if (!changed && !repeatDue) return false;

  const name = detail.label || id;
  const who = detail.phone ? `${name} (${detail.phone})` : name;
  const title = state === "ok" ? `WA gateway pulih: ${who}` : `WA gateway ${LABEL[state]}: ${who}`;
  const lines = [
    `<p><b>${who}</b> — ${LABEL[state]}.</p>`,
    detail.reason ? `<p>Sebab: ${escapeHtml(detail.reason)}</p>` : "",
    detail.since ? `<p>Putus sejak: ${new Date(detail.since).toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })}</p>` : "",
    state === "logged_out"
      ? "<p>Tindakan: buka <a href=\"https://wa.syababfresh.my/\">laman gateway</a>, padam session lama, Jana QR dan imbas semula dengan telefon nombor ini.</p>"
      : state === "down"
        ? "<p>Tindakan: pastikan telefon nombor ini hidup dan ada internet. Gateway cuba sambung semula sendiri; kalau lebih 30 minit, tekan Sambung semula di laman gateway.</p>"
        : state === "unreachable"
          ? "<p>Tindakan: semak VPS (SumoPod) dan servis <code>syabab-wa-gateway</code>. Semua WA storefront tertangguh selagi gateway mati.</p>"
          : "<p>Tiada tindakan diperlukan.</p>",
    `<p style=\"color:#6b7280;font-size:12px\">${now.toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" })} · pemeriksa wa-gateway</p>`,
  ].filter(Boolean).join("");

  await Promise.allSettled([
    sendAdminEmail({ subject: title, html: lines }),
    sendAdminPush({ title, body: state === "ok" ? "Nombor kembali connected." : (detail.reason || LABEL[state]).slice(0, 100), url: "/admin/settings/whatsapp", tag: `wa-gateway-${id}` }),
  ]);
  await writeState(sb, id, { state, at: changed ? now.toISOString() : (prev?.at ?? now.toISOString()), notified_at: now.toISOString() });
  return true;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] as string));
}
