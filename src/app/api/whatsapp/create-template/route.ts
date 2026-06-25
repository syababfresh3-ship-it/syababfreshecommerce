// ============================================================
// api/whatsapp/create-template — cipta template WhatsApp baru → hantar ke
// Meta untuk audit. Sokong header teks/gambar + body (variable) + footer + button URL.
// Gambar header diupload ke Meta (resumable upload) untuk dapat handle.
// Admin only.
// ============================================================
export const runtime = "nodejs";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const GRAPH = "https://graph.facebook.com/v21.0";
const APP_ID = process.env.WHATSAPP_APP_ID || "1773148447211861";

// Upload sample gambar header ke Meta → pulang handle (untuk example.header_handle)
async function uploadHeaderImage(file: File, token: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const startRes = await fetch(
    `${GRAPH}/${APP_ID}/uploads?file_length=${buf.length}&file_type=${encodeURIComponent(file.type)}&access_token=${token}`,
    { method: "POST" },
  );
  const start = await startRes.json();
  if (!start.id) throw new Error("Sesi upload gambar gagal");
  const upRes = await fetch(`${GRAPH}/${start.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_offset: "0" },
    body: buf,
  });
  const up = await upRes.json();
  if (!up.h) throw new Error("Upload gambar header gagal");
  return up.h as string;
}

export async function POST(request: Request) {
  const { forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const token = process.env.WHATSAPP_TOKEN;
  let waba = process.env.WHATSAPP_WABA_ID;

  const fd = await request.formData();

  // Per-WABA: kalau phoneId diberi, cipta template di WABA nombor itu
  // (cth nombor #2 Syabab Fresh ll), bukan WABA utama.
  const phoneId = String(fd.get("phoneId") || "").trim();
  if (phoneId) {
    const sb = createAdminClient();
    const { data: num } = await sb.from("wa_numbers").select("waba_id").eq("phone_number_id", phoneId).maybeSingle();
    if (num?.waba_id) waba = num.waba_id as string;
  }

  if (!token || !waba) return NextResponse.json({ error: "WhatsApp belum dikonfigurasi." }, { status: 503 });
  const rawName = String(fd.get("name") || "").trim();
  const name = rawName.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const category = String(fd.get("category") || "MARKETING");
  const language = String(fd.get("language") || "ms");
  const bodyText = String(fd.get("bodyText") || "").trim();
  let variables: { name: string; example: string }[] = [];
  try {
    variables = JSON.parse(String(fd.get("variables") || "[]"));
  } catch {
    /* abaikan */
  }
  const headerType = String(fd.get("headerType") || "none");
  const headerText = String(fd.get("headerText") || "").trim();
  const footerText = String(fd.get("footerText") || "").trim();
  const buttonText = String(fd.get("buttonText") || "").trim();
  const buttonUrl = String(fd.get("buttonUrl") || "").trim();
  const headerImage = fd.get("headerImage") as File | null;

  if (!name) return NextResponse.json({ error: "Nama template diperlukan." }, { status: 400 });
  if (!bodyText) return NextResponse.json({ error: "Isi (body) template diperlukan." }, { status: 400 });

  const components: Record<string, unknown>[] = [];

  // Header
  try {
    if (headerType === "image" && headerImage && headerImage.size > 0) {
      const handle = await uploadHeaderImage(headerImage, token);
      components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [handle] } });
    } else if (headerType === "text" && headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: headerText });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 });
  }

  // Body — sokong NAMED ({{nama}}) & POSITIONAL ({{1}})
  const names = Array.from(bodyText.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map((m) => m[1]);
  const isNamed = names.length > 0 && !names.every((n) => /^\d+$/.test(n));
  const exMap: Record<string, string> = {};
  variables.forEach((v) => (exMap[v.name] = v.example));
  const body: Record<string, unknown> = { type: "BODY", text: bodyText };
  if (names.length > 0) {
    if (isNamed) {
      body.example = { body_text_named_params: names.map((n) => ({ param_name: n, example: exMap[n] || "contoh" })) };
    } else {
      const ordered = names.slice().sort((a, b) => Number(a) - Number(b)).map((n) => exMap[n] || "contoh");
      body.example = { body_text: [ordered] };
    }
  }
  components.push(body);

  if (footerText) components.push({ type: "FOOTER", text: footerText });
  if (buttonText && buttonUrl) {
    components.push({ type: "BUTTONS", buttons: [{ type: "URL", text: buttonText, url: buttonUrl }] });
  }

  const res = await fetch(`${GRAPH}/${waba}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, category, language, parameter_format: isNamed ? "NAMED" : "POSITIONAL", components }),
  });
  const j = await res.json();
  if (!res.ok || j.error) {
    return NextResponse.json(
      { error: j?.error?.error_user_msg || j?.error?.message || "Gagal cipta template." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, id: j.id, status: j.status, name });
}
