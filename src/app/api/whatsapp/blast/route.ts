// ============================================================
// api/whatsapp/blast — hantar kempen template (admin).
// GET  = senarai kempen. POST = cipta + hantar blast.
// Hormati opt_out. Log per-penerima ke crm_blast_recipients.
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplate, formatWaPhone } from "@/lib/whatsapp-cloud";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    .from("crm_blasts")
    .select("id, name, template_name, status, total, sent, failed, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ blasts: data ?? [] });
}

interface Recipient { wa_id: string; name: string | null }

export async function POST(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    name,
    templateName,
    templateLang = "ms",
    params = {},
    audience = {},
    test = false,
    testNumber,
  } = body as {
    name?: string;
    templateName?: string;
    templateLang?: string;
    params?: Record<string, string>;
    audience?: { source?: string; tag?: string };
    test?: boolean;
    testNumber?: string;
  };

  if (!templateName) return NextResponse.json({ error: "templateName diperlukan." }, { status: 400 });

  // --- Resolusi penerima ---
  let recipients: Recipient[] = [];
  if (test && testNumber) {
    recipients = [{ wa_id: formatWaPhone(testNumber), name: null }];
  } else if (audience.source === "contacts") {
    let q = sb.from("wa_contacts").select("wa_id, name, tags").eq("opt_out", false);
    if (audience.tag) q = q.contains("tags", [audience.tag]);
    const { data } = await q;
    recipients = (data ?? []).map((c) => ({ wa_id: c.wa_id, name: c.name }));
  } else if (audience.source === "customers") {
    const [{ data: profs }, { data: opted }] = await Promise.all([
      sb.from("profiles").select("full_name, phone").not("phone", "is", null).eq("is_admin", false),
      sb.from("wa_contacts").select("wa_id").eq("opt_out", true),
    ]);
    const optedSet = new Set((opted ?? []).map((o) => o.wa_id));
    recipients = (profs ?? [])
      .map((p) => ({ wa_id: formatWaPhone(p.phone as string), name: p.full_name as string | null }))
      .filter((r) => !optedSet.has(r.wa_id));
  } else {
    return NextResponse.json({ error: "audience.source tidak sah (contacts|customers) atau guna test." }, { status: 400 });
  }

  // Dedupe
  const seen = new Set<string>();
  recipients = recipients.filter((r) => r.wa_id && !seen.has(r.wa_id) && seen.add(r.wa_id));
  if (recipients.length === 0) return NextResponse.json({ error: "Tiada penerima." }, { status: 400 });

  // --- Cipta kempen ---
  const { data: blast } = await sb
    .from("crm_blasts")
    .insert({
      name: name || `Blast ${templateName}`,
      template_name: templateName,
      template_lang: templateLang,
      params,
      audience,
      status: "sending",
      total: recipients.length,
      created_by: user.id,
    })
    .select("id")
    .single();
  const blastId = blast!.id as string;

  // --- Hantar (rate-limited) ---
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const p = { ...params };
    for (const key of ["nama", "name"]) {
      if (key in p && (!p[key] || !p[key].trim())) p[key] = r.name || "pelanggan";
    }
    const res = await sendTemplate(r.wa_id, templateName, templateLang, p);
    if (res.ok) sent++;
    else failed++;
    await sb.from("crm_blast_recipients").insert({
      blast_id: blastId,
      wa_id: r.wa_id,
      name: r.name,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : res.error,
      wa_message_id: res.id ?? null,
      sent_at: res.ok ? new Date().toISOString() : null,
    });
    await sleep(120); // ~8/saat — elak rate limit
  }

  await sb.from("crm_blasts").update({ status: "sent", sent, failed }).eq("id", blastId);
  return NextResponse.json({ ok: true, blastId, total: recipients.length, sent, failed });
}
