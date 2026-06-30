// ============================================================
// whatsapp-cloud.ts — WhatsApp Business Cloud API rasmi (Meta).
// Untuk CRM (inbox/reply/blast). BERASINGAN dari Murpati (lib/murpati.ts)
// yang kekal untuk bulk murah. Server-only — guna WHATSAPP_TOKEN.
// ============================================================

const GRAPH = "https://graph.facebook.com/v21.0";

function cfg() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_WABA_ID;
  if (!token || !phoneId) {
    throw new Error("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID tidak ditetapkan dalam env.");
  }
  return { token, phoneId, wabaId };
}

// Normalkan nombor ke E.164 tanpa '+': 0123→60123, 123→60123.
export function formatWaPhone(phone: string): string {
  let p = (phone || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "60" + p.slice(1);
  else if (!p.startsWith("60")) p = "60" + p;
  return p;
}

// Download media masuk (gambar/video/audio/dokumen) dari Meta. WhatsApp hantar
// media ID sahaja; perlu 2 langkah: dapat URL → muat turun dengan token.
export async function downloadWaMedia(
  mediaId: string,
  opts?: { token?: string },
): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
  const token = opts?.token || process.env.WHATSAPP_TOKEN;
  if (!token) return null;
  try {
    const r1 = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    const j1 = await r1.json().catch(() => ({}));
    if (!r1.ok || !j1.url) return null;
    const r2 = await fetch(j1.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r2.ok) return null;
    return { data: await r2.arrayBuffer(), mimeType: (j1.mime_type as string) || "application/octet-stream" };
  } catch {
    return null;
  }
}

type SendResult = { ok: boolean; id?: string; error?: string };

// Multi-number: hantar dari phoneId/token tertentu (lalai = env). Caller resolve
// dari wa_numbers ikut conversation.phone_number_id (lihat src/lib/wa-numbers.ts).
export type SendOpts = { phoneId?: string; token?: string };

async function postMessage(payload: Record<string, unknown>, opts?: SendOpts): Promise<SendResult> {
  const token = opts?.token || process.env.WHATSAPP_TOKEN;
  const phoneId = opts?.phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "WHATSAPP_TOKEN / phoneId tidak ditetapkan." };
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) {
      return { ok: false, error: j?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, id: j?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Teks bebas — HANYA sah dalam tetingkap 24 jam (selepas customer mesej).
// Luar window, Meta tolak (gunakan sendTemplate).
export async function sendText(to: string, body: string, opts?: SendOpts): Promise<SendResult> {
  return postMessage({
    to: formatWaPhone(to),
    type: "text",
    text: { preview_url: true, body },
  }, opts);
}

// Hantar gambar/video via URL public (cth Cloudinary) — dalam window 24j.
export async function sendMedia(
  to: string,
  link: string,
  caption?: string,
  kind: "image" | "video" | "document" = "image",
  opts?: SendOpts,
): Promise<SendResult> {
  return postMessage({
    to: formatWaPhone(to),
    type: kind,
    [kind]: { link, ...(caption ? { caption } : {}) },
  }, opts);
}

// Hantar TEMPLATE diluluskan. `bodyParams` = named params, cth { nama: "Ali", item: "Harumanis" }.
// (Template SyababFresh guna NAMED params — wajib parameter_name.)
export async function sendTemplate(
  to: string,
  name: string,
  language: string,
  bodyParams?: Record<string, string>,
  header?: string | { type: "image" | "video" | "document"; link: string },
  opts?: SendOpts,
): Promise<SendResult> {
  const components: unknown[] = [];
  // Header media — string = IMAGE (backward-compat) | objek = image/video/document.
  if (header) {
    const h = typeof header === "string" ? { type: "image" as const, link: header } : header;
    components.push({ type: "header", parameters: [{ type: h.type, [h.type]: { link: h.link } }] });
  }
  if (bodyParams && Object.keys(bodyParams).length) {
    const keys = Object.keys(bodyParams);
    // Sokong dua format: POSITIONAL ({{1}}) vs NAMED ({{nama}})
    const positional = keys.every((k) => /^\d+$/.test(k));
    const parameters = positional
      ? keys.sort((a, b) => Number(a) - Number(b)).map((k) => ({ type: "text", text: bodyParams[k] ?? "" }))
      : keys.map((k) => ({ type: "text", parameter_name: k, text: bodyParams[k] ?? "" }));
    components.push({ type: "body", parameters });
  }
  return postMessage({
    to: formatWaPhone(to),
    type: "template",
    template: { name, language: { code: language }, ...(components.length ? { components } : {}) },
  }, opts);
}

export interface WaTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: unknown[];
}

// Senarai template. approvedOnly=true (default) → untuk pilih masa blast/reply.
// approvedOnly=false → semua status (untuk page pengurusan Templates).
export async function listTemplates(
  approvedOnly = true,
  wabaOverride?: string,
): Promise<{ ok: boolean; templates: WaTemplate[]; error?: string }> {
  const { token, wabaId } = cfg();
  // Template adalah per-WABA: guna WABA nombor tertentu kalau diberi, jika tidak WABA utama (env).
  const waba = wabaOverride || wabaId;
  if (!waba) return { ok: false, templates: [], error: "WHATSAPP_WABA_ID tidak ditetapkan." };
  try {
    const res = await fetch(
      `${GRAPH}/${waba}/message_templates?fields=id,name,language,category,status,components&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) return { ok: false, templates: [], error: j?.error?.message || `HTTP ${res.status}` };
    const all = (j.data ?? []) as WaTemplate[];
    return { ok: true, templates: approvedOnly ? all.filter((t) => t.status === "APPROVED") : all };
  } catch (e) {
    return { ok: false, templates: [], error: String(e) };
  }
}

// Tanda mesej masuk sebagai 'read' (tick biru) — kemas inbox.
export async function markRead(messageId: string, opts?: SendOpts): Promise<SendResult> {
  return postMessage({ status: "read", message_id: messageId }, opts);
}
