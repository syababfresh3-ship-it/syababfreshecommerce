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
import { drainBlasts } from "@/lib/blast-drain";

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

  const { data: blasts } = await sb
    .from("crm_blasts")
    .select("id, name, template_name, status, total, sent, failed, scheduled_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Progress sebenar (delivered/read) dari view — webhook yang kemas status penerima.
  const ids = (blasts ?? []).map((b) => b.id);
  const { data: progress } = ids.length
    ? await sb.from("crm_blast_progress").select("*").in("blast_id", ids)
    : { data: [] as { blast_id: string }[] };
  const pMap = new Map((progress ?? []).map((p: { blast_id: string }) => [p.blast_id, p]));

  const withProgress = (blasts ?? []).map((b) => ({
    ...b,
    progress: pMap.get(b.id) ?? { total: b.total ?? 0, pending: 0, sent: b.sent ?? 0, delivered: 0, read: 0, failed: b.failed ?? 0 },
  }));

  // Stats dashboard (semua campaign).
  const { data: ov } = await sb.rpc("crm_blaster_overview");
  const stats = Array.isArray(ov) ? ov[0] : ov;

  return NextResponse.json({ blasts: withProgress, stats: stats ?? null });
}

interface Recipient { wa_id: string; name: string | null; vars?: Record<string, string> }

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
    headerImage,
    scheduledAt,
  } = body as {
    name?: string;
    templateName?: string;
    templateLang?: string;
    params?: Record<string, string>;
    audience?: {
      source?: string;
      tag?: string;
      recentDays?: number;
      numbers?: string[];
      rows?: { phone: string; name?: string; vars?: Record<string, string> }[];
      pastBlastId?: string;
    };
    test?: boolean;
    testNumber?: string;
    headerImage?: string;
    scheduledAt?: string;
  };

  if (!templateName) return NextResponse.json({ error: "templateName diperlukan." }, { status: 400 });

  // --- Test: hantar segerak ke 1 nombor, TANPA cipta campaign ---
  if (test) {
    if (!testNumber) return NextResponse.json({ error: "Masukkan nombor test." }, { status: 400 });
    const p = { ...params };
    for (const key of ["nama", "name"]) if (key in p && (!p[key] || !p[key].trim())) p[key] = "pelanggan";
    const res = await sendTemplate(formatWaPhone(testNumber), templateName, templateLang, p, headerImage);
    return NextResponse.json({ ok: res.ok, sent: res.ok ? 1 : 0, failed: res.ok ? 0 : 1, error: res.error });
  }

  // --- Resolusi penerima ---
  let recipients: Recipient[] = [];
  if (audience.source === "contacts") {
    let q = sb.from("wa_contacts").select("wa_id, name, tags, last_inbound_at").eq("opt_out", false);
    if (audience.tag) q = q.contains("tags", [audience.tag]);
    if (audience.recentDays && audience.recentDays > 0) {
      const since = new Date(Date.now() - audience.recentDays * 86_400_000).toISOString();
      q = q.gte("last_inbound_at", since);
    }
    const { data } = await q;
    recipients = (data ?? []).map((c) => ({ wa_id: c.wa_id, name: c.name }));
  } else if (audience.source === "customers") {
    const { data: profs } = await sb.from("profiles").select("full_name, phone").not("phone", "is", null).eq("is_admin", false);
    recipients = (profs ?? []).map((p) => ({ wa_id: formatWaPhone(p.phone as string), name: p.full_name as string | null }));
  } else if (audience.source === "paste") {
    recipients = (audience.numbers ?? []).map((n) => ({ wa_id: formatWaPhone(n), name: null }));
  } else if (audience.source === "csv") {
    recipients = (audience.rows ?? []).map((r) => ({ wa_id: formatWaPhone(r.phone), name: r.name ?? null, vars: r.vars }));
  } else if (audience.source === "past") {
    if (!audience.pastBlastId) return NextResponse.json({ error: "pastBlastId diperlukan." }, { status: 400 });
    const { data } = await sb.from("crm_blast_recipients").select("wa_id, name").eq("blast_id", audience.pastBlastId);
    recipients = (data ?? []).map((c) => ({ wa_id: c.wa_id, name: c.name }));
  } else {
    return NextResponse.json({ error: "audience.source tidak sah." }, { status: 400 });
  }

  // Buang nombor tak sah (min 8 digit) + dedupe
  const seen = new Set<string>();
  recipients = recipients.filter((r) => r.wa_id && r.wa_id.replace(/\D/g, "").length >= 8 && !seen.has(r.wa_id) && seen.add(r.wa_id));

  // Hormati suppression untuk SEMUA sumber non-test — opt_out kontak + senarai suppression.
  if (!test && recipients.length) {
    const [{ data: opted }, { data: supp }] = await Promise.all([
      sb.from("wa_contacts").select("wa_id").eq("opt_out", true),
      sb.from("crm_suppressions").select("wa_id"),
    ]);
    const blocked = new Set([...(opted ?? []), ...(supp ?? [])].map((o: { wa_id: string }) => o.wa_id));
    recipients = recipients.filter((r) => !blocked.has(r.wa_id));
  }

  if (recipients.length === 0) return NextResponse.json({ error: "Tiada penerima." }, { status: 400 });
  if (!test && recipients.length > 5000) return NextResponse.json({ error: "Terlalu ramai penerima (max 5000)." }, { status: 400 });

  // --- Jadual: send-now vs scheduled (>30s ke depan = dijadualkan) ---
  const schedMs = scheduledAt ? new Date(scheduledAt).getTime() : 0;
  const isScheduled = Number.isFinite(schedMs) && schedMs > Date.now() + 30_000;
  const startAt = isScheduled ? new Date(schedMs).toISOString() : new Date().toISOString();

  // --- Cipta kempen (status queue) ---
  const { data: blast } = await sb
    .from("crm_blasts")
    .insert({
      name: name || `Blast ${templateName}`,
      template_name: templateName,
      template_lang: templateLang,
      params,
      header_image: headerImage || null,
      audience,
      status: isScheduled ? "scheduled" : "sending",
      scheduled_at: startAt,
      total: recipients.length,
      created_by: user.id,
    })
    .select("id")
    .single();
  const blastId = blast!.id as string;

  // --- Queue penerima (pending + merge vars) — drainer (cron/send-now) yang hantar ---
  const queueRows = recipients.map((r) => ({
    blast_id: blastId, wa_id: r.wa_id, name: r.name, vars: r.vars ?? {}, status: "pending",
  }));
  for (let i = 0; i < queueRows.length; i += 500) {
    await sb.from("crm_blast_recipients").insert(queueRows.slice(i, i + 500));
  }

  if (isScheduled) {
    return NextResponse.json({ ok: true, blastId, total: recipients.length, scheduled: true, scheduledAt: startAt });
  }

  // Send-now: mulakan drain serta-merta (batch pertama keluar sekarang; baki oleh cron).
  const { sent } = await drainBlasts(sb, { budgetMs: 25_000, blastId });
  return NextResponse.json({ ok: true, blastId, total: recipients.length, sent, queued: recipients.length - sent });
}
