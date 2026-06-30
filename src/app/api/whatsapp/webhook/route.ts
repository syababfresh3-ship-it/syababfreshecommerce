// ============================================================
// api/whatsapp/webhook — terima mesej masuk + status (WA Cloud API).
// GET  = verify (Meta hub.challenge). POST = mesej/status callback.
// Simpan ke wa_* + auto-cipta crm_leads. Guna service-role (bypass RLS).
// BERASINGAN — tak sentuh webhook CHIP / kod sedia ada.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCapiLeadWhatsApp } from "@/lib/meta-capi";
import { maybeAiReply } from "@/lib/ai/wa-agent";
import { downloadWaMedia } from "@/lib/whatsapp-cloud";

// ---- GET: pengesahan webhook Meta ----
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ---- POST: mesej masuk / status ----
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Sahkan signature (kalau app secret diset)
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") || "";
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return new NextResponse("Bad signature", { status: 401 });
    }
  }

  let body: WaWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Balas 200 cepat; proses best-effort (Meta retry kalau bukan 200).
  try {
    await handle(body);
  } catch (e) {
    console.error("[wa webhook] proses gagal:", e);
  }
  return NextResponse.json({ ok: true });
}

// ---------- jenis ringkas ----------
interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  // Hadir HANYA bila mesej berasal dari iklan Click-to-WhatsApp (CTWA).
  referral?: {
    source_id?: string;
    source_type?: string;
    source_url?: string;
    headline?: string;
    body?: string;
    ctwa_clid?: string;
  };
  [k: string]: unknown;
}
interface WaStatus {
  id: string;
  status: string;
}
interface WaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: WaMessage[];
        statuses?: WaStatus[];
      };
    }>;
  }>;
}

type Admin = ReturnType<typeof createAdminClient>;

// Download media masuk dari Meta + simpan ke storage public → pulang URL.
// Best-effort: null kalau gagal (inbox papar [type]).
const MEDIA_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr",
  "application/pdf": "pdf",
};
async function storeWaMedia(sb: Admin, mediaId: string, msgId: string): Promise<string | null> {
  try {
    const media = await downloadWaMedia(mediaId);
    if (!media) return null;
    const mime = media.mimeType.split(";")[0].trim();
    const ext = MEDIA_EXT[mime] || mime.split("/")[1] || "bin";
    const path = `wa-media/${msgId.replace(/[^a-zA-Z0-9_-]/g, "")}.${ext}`;
    const { error } = await sb.storage
      .from("brand-assets")
      .upload(path, Buffer.from(media.data), { contentType: mime, upsert: true });
    if (error) return null;
    return sb.storage.from("brand-assets").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

async function handle(body: WaWebhookBody) {
  const sb = createAdminClient();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      const phoneNumberId = v.metadata?.phone_number_id; // nombor mana customer hubungi
      const names: Record<string, string | undefined> = {};
      for (const c of v.contacts ?? []) names[c.wa_id] = c.profile?.name;

      for (const m of v.messages ?? []) {
        await handleInbound(sb, m, names[m.from], phoneNumberId);
      }
      for (const s of v.statuses ?? []) {
        await sb.from("wa_messages").update({ status: s.status }).eq("wa_message_id", s.id);
        // Jejak progress blast: advance status penerima (rank-guarded, additive).
        await sb.rpc("crm_blast_mark_status", { p_msg: s.id, p_status: s.status }).then(() => {}, () => {});
      }
    }
  }
}

async function handleInbound(sb: Admin, m: WaMessage, name?: string, phoneNumberId?: string) {
  const waId = m.from;
  const ts = new Date(Number(m.timestamp) * 1000).toISOString();
  const windowExp = new Date(Number(m.timestamp) * 1000 + 24 * 3600 * 1000).toISOString();

  // Multi-number: pemilik (salesperson) nombor yang customer hubungi → auto-assign.
  let ownerId: string | null = null;
  if (phoneNumberId) {
    const { data: num } = await sb.from("wa_numbers").select("owner").eq("phone_number_id", phoneNumberId).maybeSingle();
    ownerId = (num?.owner as string | null) ?? null;
  }

  // 1. Contact (upsert by wa_id)
  const { data: contact } = await sb
    .from("wa_contacts")
    .upsert(
      { wa_id: waId, phone: waId, name: name ?? null, last_inbound_at: ts },
      { onConflict: "wa_id" },
    )
    .select("id, profile_id")
    .single();
  if (!contact) return;
  const contactId = contact.id as string;

  // Link customer berdaftar (best-effort, kalau belum)
  if (!contact.profile_id) {
    const local = waId.slice(-8);
    const { data: prof } = await sb
      .from("profiles")
      .select("id")
      .ilike("phone", `%${local}%`)
      .limit(1)
      .maybeSingle();
    if (prof) await sb.from("wa_contacts").update({ profile_id: prof.id }).eq("id", contactId);
  }

  // 1b. CTWA — kalau mesej ini dari iklan Click-to-WhatsApp, simpan click id.
  //     Hanya bila ada referral; ambil yang TERBARU (customer klik iklan baru
  //     = attribute ke campaign baru).
  const ctwaClid = m.referral?.ctwa_clid;
  if (ctwaClid) {
    await sb
      .from("wa_contacts")
      .update({ ctwa_clid: ctwaClid, ctwa_source_id: m.referral?.source_id ?? null, ctwa_at: ts })
      .eq("id", contactId);
    // Lead top-of-funnel ke Meta (dedup per click via event_id).
    void sendCapiLeadWhatsApp({ ctwa_clid: ctwaClid, phone: waId }).catch(() => {});
  }

  // 2. Body / preview
  const type = m.type;
  let bodyText: string | null;
  if (type === "text") {
    bodyText = m.text?.body ?? null;
  } else if (type === "button") {
    // Quick-reply butang template (cth "Saya Nak") — ambil teks butang.
    const b = m.button as { text?: string; payload?: string } | undefined;
    bodyText = b?.text ?? b?.payload ?? null;
  } else if (type === "interactive") {
    // Butang/senarai interaktif — ambil tajuk pilihan.
    const it = m.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } } | undefined;
    bodyText = it?.button_reply?.title ?? it?.list_reply?.title ?? null;
  } else {
    bodyText = (m[type] as { caption?: string } | undefined)?.caption ?? null;
  }
  const preview = bodyText ?? `[${type}]`;

  // Media masuk (gambar/video/audio/dokumen) — download dari Meta + simpan ke
  // storage supaya boleh dipapar dalam inbox (WhatsApp hantar media ID sahaja).
  let mediaUrl: string | null = null;
  if (["image", "video", "audio", "voice", "document", "sticker"].includes(type)) {
    const mediaId = (m[type] as { id?: string } | undefined)?.id;
    if (mediaId) mediaUrl = await storeWaMedia(sb, mediaId, m.id);
  }

  // Opt-out: customer balas STOP/BERHENTI → tak terima blast lagi
  if (type === "text" && bodyText) {
    const t = bodyText.trim().toLowerCase();
    if (["stop", "unsubscribe", "unsub", "berhenti", "stop promosi"].includes(t)) {
      await sb.from("wa_contacts").update({ opt_out: true }).eq("id", contactId);
      // Suppression list (sumber: balas STOP) — additive.
      await sb.from("crm_suppressions").upsert({ wa_id: m.from, source: "replied_stop" }, { onConflict: "wa_id" }).then(() => {}, () => {});
    }
  }

  // 3. Conversation (cipta/kemas) — reset window 24j, +unread.
  //    Multi-number: simpan phone_number_id (nombor mana customer hubungi) +
  //    auto-assign ke pemilik nombor kalau belum ada owner.
  const { data: conv } = await sb
    .from("wa_conversations")
    .select("id, unread_count, assigned_to")
    .eq("contact_id", contactId)
    .maybeSingle();
  let convId: string;
  if (conv) {
    convId = conv.id as string;
    await sb
      .from("wa_conversations")
      .update({
        last_message_at: ts,
        last_message_preview: preview,
        window_expires_at: windowExp,
        unread_count: (conv.unread_count ?? 0) + 1,
        status: "open",
        needs_reply: true, // mesej masuk dari customer → perlu balas
        auto_followup_sent_at: null, // re-arm auto follow-up (stall baru)
        ...(phoneNumberId ? { phone_number_id: phoneNumberId } : {}),
        ...(!conv.assigned_to && ownerId ? { assigned_to: ownerId } : {}),
      })
      .eq("id", convId);
  } else {
    const { data: nc } = await sb
      .from("wa_conversations")
      .insert({
        contact_id: contactId,
        last_message_at: ts,
        last_message_preview: preview,
        window_expires_at: windowExp,
        unread_count: 1,
        needs_reply: true,
        auto_followup_sent_at: null,
        phone_number_id: phoneNumberId ?? null,
        assigned_to: ownerId,
      })
      .select("id")
      .single();
    convId = nc!.id as string;
  }

  // 4. Mesej (dedup by wa_message_id)
  await sb.from("wa_messages").upsert(
    {
      conversation_id: convId,
      contact_id: contactId,
      wa_message_id: m.id,
      direction: "in",
      type,
      body: bodyText,
      media_url: mediaUrl,
      status: "received",
      created_at: ts,
    },
    { onConflict: "wa_message_id" },
  );

  // 5. Auto-cipta Lead (kalau belum ada)
  const { data: lead } = await sb
    .from("crm_leads")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (!lead) {
    await sb.from("crm_leads").insert({ contact_id: contactId, stage: "baru", source: "inbound" });
  }

  // 6. AI chatbot (F2) — best-effort, di-await supaya selesai sebelum 200 (serverless).
  //    OFF secara lalai: maybeAiReply keluar awal kalau master switch / toggle convo OFF.
  //    Gagal senyap — tak pecahkan penyimpanan mesej di atas.
  try {
    await maybeAiReply(sb, {
      conversationId: convId,
      contactId,
      inboundText: bodyText,
      messageType: type,
      phoneNumberId,
    });
  } catch (e) {
    console.error("[wa ai] maybeAiReply gagal:", e);
  }
}
