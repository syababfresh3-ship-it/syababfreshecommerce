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
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: WaMessage[];
        statuses?: WaStatus[];
      };
    }>;
  }>;
}

type Admin = ReturnType<typeof createAdminClient>;

async function handle(body: WaWebhookBody) {
  const sb = createAdminClient();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      const names: Record<string, string | undefined> = {};
      for (const c of v.contacts ?? []) names[c.wa_id] = c.profile?.name;

      for (const m of v.messages ?? []) {
        await handleInbound(sb, m, names[m.from]);
      }
      for (const s of v.statuses ?? []) {
        await sb.from("wa_messages").update({ status: s.status }).eq("wa_message_id", s.id);
      }
    }
  }
}

async function handleInbound(sb: Admin, m: WaMessage, name?: string) {
  const waId = m.from;
  const ts = new Date(Number(m.timestamp) * 1000).toISOString();
  const windowExp = new Date(Number(m.timestamp) * 1000 + 24 * 3600 * 1000).toISOString();

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

  // 2. Body / preview
  const type = m.type;
  const bodyText =
    type === "text"
      ? m.text?.body ?? null
      : ((m[type] as { caption?: string } | undefined)?.caption ?? null);
  const preview = bodyText ?? `[${type}]`;

  // 3. Conversation (cipta/kemas) — reset window 24j, +unread
  const { data: conv } = await sb
    .from("wa_conversations")
    .select("id, unread_count")
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
}
