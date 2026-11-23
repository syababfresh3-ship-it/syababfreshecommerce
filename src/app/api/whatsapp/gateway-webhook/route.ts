// ============================================================
// api/whatsapp/gateway-webhook — terima peristiwa dari gateway WhatsApp sendiri
// (wa.syababfresh.my, Baileys): mesej masuk, mesej yang staf taip terus di telefon,
// resit (sent/delivered/read) dan reaksi. Simpan ke jadual inbox yang SAMA
// (wa_contacts / wa_conversations / wa_messages) supaya nombor gateway muncul
// dalam Inbox WhatsApp sebelah nombor Meta. BERASINGAN daripada webhook Meta.
//
// Keselamatan: header X-Webhook-Secret mesti sama dengan env WA_GATEWAY_WEBHOOK_SECRET.
// Nombor gateway didaftar automatik dalam wa_numbers sebagai 'gw:<session_id>'.
// Tetingkap 24 jam tidak terpakai pada nombor tak rasmi → window_expires_at diset jauh
// ke hadapan supaya komposer inbox sedia ada terus membenarkan teks bebas.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminPush } from "@/lib/push";
import { isOptOutReply } from "@/lib/wa-optout";
import { gatewayFetchMedia, gatewayNumberId } from "@/lib/wa-gateway";
import { reportGatewayState } from "@/lib/wa-gateway-alerts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

interface GwMedia { mime: string; filename: string | null; size: number; path: string }
interface GwEvent {
  event: "message" | "status" | "reaction" | "session";
  session_id: string;
  session_phone?: string | null;
  device_name?: string | null;
  message_id?: string | null;
  from?: string | null;
  from_jid?: string | null;
  is_group?: boolean;
  from_me?: boolean;
  push_name?: string | null;
  timestamp?: string;
  type?: string;
  text?: string | null;
  media?: GwMedia | null;
  status?: string;
  emoji?: string | null;
  phone_number?: string | null;
  reason?: string | null;
  since?: string | null;
}

const MEDIA_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
  "application/pdf": "pdf",
};
const FAR_FUTURE_DAYS = 3650;

function secretOk(req: NextRequest): boolean {
  const expected = process.env.WA_GATEWAY_WEBHOOK_SECRET || "";
  const got = req.headers.get("x-webhook-secret") || "";
  if (!expected || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!process.env.WA_GATEWAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "WA_GATEWAY_WEBHOOK_SECRET belum diset" }, { status: 503 });
  }
  if (!secretOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ev = (await req.json().catch(() => null)) as GwEvent | null;
  if (!ev || !ev.event || !ev.session_id) return NextResponse.json({ error: "payload tidak sah" }, { status: 400 });

  const sb = createAdminClient();
  try {
    if (ev.event === "status") await handleStatus(sb, ev);
    else if (ev.event === "reaction") await handleReaction(sb, ev);
    else if (ev.event === "message") await handleMessage(sb, ev);
    else if (ev.event === "session") await handleSession(sb, ev);
  } catch (e) {
    console.error("[gateway-webhook] gagal:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function handleStatus(sb: Admin, ev: GwEvent) {
  if (!ev.message_id || !ev.status) return;
  // Kempen Blaster gateway (lib/blast-gateway): penerima dipadankan ikut wa_message_id — RPC sama dgn webhook Official.
  if (["sent", "delivered", "read", "failed"].includes(ev.status)) {
    await sb.rpc("crm_blast_mark_status", { p_msg: ev.message_id, p_status: ev.status }).then(() => {}, () => {});
  }
  // Jangan turunkan status (read → delivered) bila resit sampai tak ikut turutan.
  const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 9 };
  const { data: row } = await sb.from("wa_messages").select("status").eq("wa_message_id", ev.message_id).maybeSingle();
  if (!row) return;
  if ((rank[ev.status] ?? 0) >= (rank[row.status as string] ?? 0)) {
    await sb.from("wa_messages").update({ status: ev.status }).eq("wa_message_id", ev.message_id);
  }
}

// Keadaan session dari gateway: disconnected (>5 min) / logged_out / connected (pulih) → emel + push admin.
async function handleSession(sb: Admin, ev: GwEvent) {
  const state = ev.status === "connected" ? "ok" : ev.status === "logged_out" ? "logged_out" : ev.status === "disconnected" ? "down" : null;
  if (!state) return;
  await reportGatewayState(sb, ev.session_id, state, { label: ev.device_name ?? null, phone: ev.phone_number ?? null, reason: ev.reason ?? null, since: ev.since ?? null });
}

async function handleReaction(sb: Admin, ev: GwEvent) {
  if (!ev.message_id) return;
  await sb.from("wa_messages").update({ reaction: ev.emoji || null }).eq("wa_message_id", ev.message_id);
}

async function ensureNumber(sb: Admin, ev: GwEvent): Promise<{ id: string; owner: string | null }> {
  const id = gatewayNumberId(ev.session_id);
  const { data } = await sb.from("wa_numbers").select("phone_number_id, owner, is_active").eq("phone_number_id", id).maybeSingle();
  if (data) return { id, owner: (data.owner as string | null) ?? null };
  const label = ev.device_name?.trim() || ev.session_phone || ev.session_id;
  await sb.from("wa_numbers").insert({ phone_number_id: id, display_name: `${label} (gateway)`, is_active: true, is_default: false }).then(() => {}, () => {});
  return { id, owner: null };
}

async function storeMedia(sb: Admin, media: GwMedia, msgId: string): Promise<string | null> {
  const got = await gatewayFetchMedia(media.path);
  if (!got) return null;
  const mime = got.mime || media.mime || "application/octet-stream";
  const ext = MEDIA_EXT[mime] || mime.split("/")[1] || "bin";
  const path = `wa-media/${msgId.replace(/[^a-zA-Z0-9_-]/g, "")}.${ext}`;
  const { error } = await sb.storage.from("brand-assets").upload(path, Buffer.from(got.data), { contentType: mime, upsert: true });
  if (error) return null;
  return sb.storage.from("brand-assets").getPublicUrl(path).data.publicUrl;
}

async function handleMessage(sb: Admin, ev: GwEvent) {
  if (!ev.message_id) return;
  if (ev.is_group) return; // kumpulan belum disokong dalam inbox
  const waId = (ev.from || "").replace(/\D/g, "");
  if (!waId) return; // pengirim LID tanpa pemetaan nombor — tiada identiti kontak
  const ts = ev.timestamp && !Number.isNaN(Date.parse(ev.timestamp)) ? new Date(ev.timestamp).toISOString() : new Date().toISOString();
  const type = ev.type || "text";
  const bodyText = ev.text ?? null;
  const preview = bodyText ?? `[${type}]`;
  const number = await ensureNumber(sb, ev);

  // 1. Kontak (upsert ikut wa_id). Mesej kami sendiri (from_me) tidak mengemas last_inbound_at.
  const { data: contact } = await sb
    .from("wa_contacts")
    .upsert(
      ev.from_me
        ? { wa_id: waId, phone: waId }
        : { wa_id: waId, phone: waId, ...(ev.push_name ? { name: ev.push_name } : {}), last_inbound_at: ts },
      { onConflict: "wa_id" },
    )
    .select("id, profile_id")
    .single();
  if (!contact) return;
  const contactId = contact.id as string;
  if (!contact.profile_id) {
    const { data: prof } = await sb.from("profiles").select("id").ilike("phone", `%${waId.slice(-8)}%`).limit(1).maybeSingle();
    if (prof) await sb.from("wa_contacts").update({ profile_id: prof.id }).eq("id", contactId);
  }

  // 2. Media (muat turun dari gateway → storage, sama laluan dengan media Meta)
  let mediaUrl: string | null = null;
  if (ev.media?.path) mediaUrl = await storeMedia(sb, ev.media, ev.message_id);

  // 3. Opt-out (STOP/BERHENTI) hanya untuk mesej masuk
  if (!ev.from_me && type === "text" && bodyText && isOptOutReply(bodyText)) {
    await sb.from("wa_contacts").update({ opt_out: true }).eq("id", contactId);
    await sb.from("crm_suppressions").upsert({ wa_id: waId, source: "replied_stop" }, { onConflict: "wa_id" }).then(() => {}, () => {});
  }

  // 4. Perbualan
  const windowExp = new Date(Date.now() + FAR_FUTURE_DAYS * 86400_000).toISOString();
  const { data: conv } = await sb.from("wa_conversations").select("id, unread_count, assigned_to").eq("contact_id", contactId).maybeSingle();
  let convId: string;
  if (conv) {
    convId = conv.id as string;
    await sb
      .from("wa_conversations")
      .update({
        last_message_at: ts,
        last_message_preview: preview,
        window_expires_at: windowExp,
        phone_number_id: number.id,
        status: "open",
        ...(ev.from_me
          ? { needs_reply: false }
          : { unread_count: (conv.unread_count ?? 0) + 1, needs_reply: true, auto_followup_sent_at: null }),
        ...(!conv.assigned_to && number.owner ? { assigned_to: number.owner } : {}),
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
        unread_count: ev.from_me ? 0 : 1,
        needs_reply: !ev.from_me,
        auto_followup_sent_at: null,
        phone_number_id: number.id,
        assigned_to: number.owner,
      })
      .select("id")
      .single();
    convId = nc!.id as string;
  }

  // 5. Mesej — dedup ikut wa_message_id. Mesej keluar yang dihantar dari inbox sudah ada
  //    barisnya (route send) → ignoreDuplicates supaya tidak ditimpa.
  await sb.from("wa_messages").upsert(
    {
      conversation_id: convId,
      contact_id: contactId,
      wa_message_id: ev.message_id,
      direction: ev.from_me ? "out" : "in",
      type,
      body: bodyText,
      media_url: mediaUrl,
      status: ev.from_me ? "sent" : "received",
      created_at: ts,
    },
    { onConflict: "wa_message_id", ignoreDuplicates: true },
  );

  if (ev.from_me) return;

  // 6. Lead automatik + push admin (sama seperti webhook Meta). AI chatbot sengaja TIDAK dipanggil
  //    untuk nombor tak rasmi.
  const { data: lead } = await sb.from("crm_leads").select("id").eq("contact_id", contactId).maybeSingle();
  if (!lead) await sb.from("crm_leads").insert({ contact_id: contactId, stage: "baru", source: "inbound" }).then(() => {}, () => {});
  try {
    await sendAdminPush({
      title: `Mesej WhatsApp (${ev.device_name || "gateway"}): ${ev.push_name || waId}`,
      body: (bodyText ?? `[${type}]`).slice(0, 80),
      url: "/admin/crm/inbox",
      tag: "wa-inbox",
    });
  } catch (e) {
    console.error("[gateway-webhook] push gagal:", e);
  }
}
