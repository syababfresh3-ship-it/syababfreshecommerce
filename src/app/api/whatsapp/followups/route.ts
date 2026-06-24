// ============================================================
// api/whatsapp/followups — reminder follow-up (nudge dalaman) untuk inbox.
// GET = senarai pending (+ nama contact). POST = cipta. PATCH = tanda selesai/batal.
// Admin sahaja. TIADA mesej ke customer — pure nudge dalaman.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function auth() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, sb: null };
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { user: null, sb: null };
  return { user, sb };
}

export async function GET() {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await sb
    .from("wa_followups")
    .select("id, contact_id, conversation_id, remind_at, note, status, assigned_to, wa_contacts(name, wa_id)")
    .eq("status", "pending")
    .order("remind_at", { ascending: true })
    .limit(500);

  return NextResponse.json({ followups: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { contactId, conversationId, remindAt, note, assignedTo } = b as {
    contactId?: string; conversationId?: string; remindAt?: string; note?: string; assignedTo?: string;
  };
  if (!contactId || !remindAt) return NextResponse.json({ error: "contactId & remindAt diperlukan." }, { status: 400 });

  // assigned_to: explisit → pemilik conversation → user semasa
  let owner = assignedTo || null;
  if (!owner && conversationId) {
    const { data: conv } = await sb.from("wa_conversations").select("assigned_to").eq("id", conversationId).maybeSingle();
    owner = conv?.assigned_to ?? null;
  }
  if (!owner) owner = user.id;

  const { data, error } = await sb.from("wa_followups").insert({
    contact_id: contactId,
    conversation_id: conversationId || null,
    created_by: user.id,
    assigned_to: owner,
    remind_at: remindAt,
    note: (note ?? "").trim() || null,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { id, status } = b as { id?: string; status?: string };
  if (!id || !["done", "cancelled", "pending"].includes(status ?? "")) {
    return NextResponse.json({ error: "id & status sah diperlukan." }, { status: 400 });
  }
  const { error } = await sb.from("wa_followups")
    .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
