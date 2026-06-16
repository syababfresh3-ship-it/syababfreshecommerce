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

type SendResult = { ok: boolean; id?: string; error?: string };

async function postMessage(payload: Record<string, unknown>): Promise<SendResult> {
  const { token, phoneId } = cfg();
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
export async function sendText(to: string, body: string): Promise<SendResult> {
  return postMessage({
    to: formatWaPhone(to),
    type: "text",
    text: { preview_url: true, body },
  });
}

// Hantar gambar/video via URL public (cth Cloudinary) — dalam window 24j.
export async function sendMedia(
  to: string,
  link: string,
  caption?: string,
  kind: "image" | "video" | "document" = "image",
): Promise<SendResult> {
  return postMessage({
    to: formatWaPhone(to),
    type: kind,
    [kind]: { link, ...(caption ? { caption } : {}) },
  });
}

// Hantar TEMPLATE diluluskan. `bodyParams` = named params, cth { nama: "Ali", item: "Harumanis" }.
// (Template SyababFresh guna NAMED params — wajib parameter_name.)
export async function sendTemplate(
  to: string,
  name: string,
  language: string,
  bodyParams?: Record<string, string>,
  headerImageUrl?: string,
): Promise<SendResult> {
  const components: unknown[] = [];
  // Header gambar (template promo yg ada IMAGE header)
  if (headerImageUrl) {
    components.push({ type: "header", parameters: [{ type: "image", image: { link: headerImageUrl } }] });
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
  });
}

export interface WaTemplate {
  name: string;
  language: string;
  category: string;
  status: string;
  components: unknown[];
}

// Senarai template diluluskan (untuk UI pilih bila balas luar window / blast).
export async function listTemplates(): Promise<{ ok: boolean; templates: WaTemplate[]; error?: string }> {
  const { token, wabaId } = cfg();
  if (!wabaId) return { ok: false, templates: [], error: "WHATSAPP_WABA_ID tidak ditetapkan." };
  try {
    const res = await fetch(
      `${GRAPH}/${wabaId}/message_templates?fields=name,language,category,status,components&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) return { ok: false, templates: [], error: j?.error?.message || `HTTP ${res.status}` };
    const templates = (j.data ?? []).filter((t: WaTemplate) => t.status === "APPROVED");
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, templates: [], error: String(e) };
  }
}

// Tanda mesej masuk sebagai 'read' (tick biru) — kemas inbox.
export async function markRead(messageId: string): Promise<SendResult> {
  return postMessage({ status: "read", message_id: messageId });
}
