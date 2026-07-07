// ============================================================
// api/whatsapp/send — balas customer dari inbox CRM (admin only).
// Teks bebas (dalam window 24j) ATAU template (luar window).
// Simpan mesej keluar ke wa_messages + kemas conversation.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText, sendTemplate, sendMedia } from "@/lib/whatsapp-cloud";
import { getSender } from "@/lib/wa-numbers";

export async function POST(req: NextRequest) {
  // Auth admin
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { conversationId, text, templateName, templateLang, templateParams, imageUrl, documentUrl, filename, caption } = body as {
    conversationId?: string;
    text?: string;
    templateName?: string;
    templateLang?: string;
    templateParams?: Record<string, string>;
    imageUrl?: string;
    documentUrl?: string; // PDF/dokumen — customer nampak `filename`
    filename?: string;
    caption?: string;
  };

  if (!conversationId) return NextResponse.json({ error: "conversationId diperlukan." }, { status: 400 });

  // Dapatkan contact (wa_id)
  const { data: conv } = await sb
    .from("wa_conversations")
    .select("id, contact_id, assigned_to, phone_number_id, wa_contacts(wa_id)")
    .eq("id", conversationId)
    .single();
  if (!conv) return NextResponse.json({ error: "Conversation tidak dijumpai." }, { status: 404 });
  const waId = (conv.wa_contacts as unknown as { wa_id: string })?.wa_id;
  if (!waId) return NextResponse.json({ error: "Contact tiada wa_id." }, { status: 400 });

  // Multi-number: hantar dari nombor yang customer hubungi (lalai = env).
  const sender = await getSender(sb, (conv as { phone_number_id?: string | null }).phone_number_id);

  // Hantar
  let result;
  let type: string;
  let preview: string;
  if (templateName) {
    result = await sendTemplate(waId, templateName, templateLang || "ms", templateParams, undefined, sender);
    type = "template";
    preview = `[template] ${templateName}`;
  } else if (imageUrl) {
    result = await sendMedia(waId, imageUrl, caption?.trim() || undefined, "image", sender);
    type = "image";
    preview = caption?.trim() || "📷 Gambar";
  } else if (documentUrl) {
    result = await sendMedia(waId, documentUrl, caption?.trim() || undefined, "document", sender, filename?.trim() || undefined);
    type = "document";
    preview = caption?.trim() || `📄 ${filename?.trim() || "Dokumen"}`;
  } else if (text && text.trim()) {
    result = await sendText(waId, text.trim(), sender);
    type = "text";
    preview = text.trim();
  } else {
    return NextResponse.json({ error: "text atau templateName diperlukan." }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Hantar gagal." }, { status: 502 });
  }

  const now = new Date().toISOString();
  // Simpan mesej keluar
  await sb.from("wa_messages").insert({
    conversation_id: conversationId,
    contact_id: conv.contact_id,
    wa_message_id: result.id,
    direction: "out",
    type,
    body: type === "text" ? text!.trim() : type === "image" || type === "document" ? caption?.trim() || null : null,
    media_url: type === "image" ? imageUrl : type === "document" ? documentUrl : null,
    template_name: templateName ?? null,
    status: "sent",
    sent_by: user.id,
    created_at: now,
  });
  // Kemas conversation + auto-assign ke admin yang balas (kalau belum ada owner)
  await sb
    .from("wa_conversations")
    .update({
      last_message_at: now,
      last_message_preview: preview,
      unread_count: 0,
      needs_reply: false, // admin dah balas
      ...(conv.assigned_to ? {} : { assigned_to: user.id }),
    })
    .eq("id", conversationId);

  return NextResponse.json({ ok: true, id: result.id });
}
