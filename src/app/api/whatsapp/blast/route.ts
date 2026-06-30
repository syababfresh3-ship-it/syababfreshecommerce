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
import { resolveAudience, type AudienceSpec } from "@/lib/blast-audience";
import { getSender } from "@/lib/wa-numbers";

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

  // ROAS attribution per kempen (additive — view crm_blast_roas).
  const { data: roasRows } = ids.length
    ? await sb.from("crm_blast_roas").select("blast_id, sent, orders_attributed, revenue, cost, roas, conversion_rate").in("blast_id", ids)
    : { data: [] as { blast_id: string }[] };
  const rMap = new Map((roasRows ?? []).map((r: { blast_id: string }) => [r.blast_id, r]));

  const withProgress = (blasts ?? []).map((b) => ({
    ...b,
    progress: pMap.get(b.id) ?? { total: b.total ?? 0, pending: 0, sent: b.sent ?? 0, delivered: 0, read: 0, failed: b.failed ?? 0 },
    roas: rMap.get(b.id) ?? null,
  }));

  // Stats dashboard (semua campaign).
  const { data: ov } = await sb.rpc("crm_blaster_overview");
  const stats = Array.isArray(ov) ? ov[0] : ov;

  return NextResponse.json({ blasts: withProgress, stats: stats ?? null });
}

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
    headerVideo,
    scheduledAt,
    phoneNumberId,
  } = body as {
    name?: string;
    templateName?: string;
    templateLang?: string;
    params?: Record<string, string>;
    audience?: AudienceSpec;
    test?: boolean;
    testNumber?: string;
    headerImage?: string;
    headerVideo?: string;
    scheduledAt?: string;
    phoneNumberId?: string;
  };
  // Header media: video diutamakan (objek), kalau tidak fallback gambar (string).
  const headerMedia = headerVideo ? ({ type: "video" as const, link: headerVideo }) : headerImage;

  if (!templateName) return NextResponse.json({ error: "templateName diperlukan." }, { status: 400 });

  // Multi-number: hantar dari nombor dipilih (lalai = env default).
  const sender = await getSender(sb, phoneNumberId);

  // --- Test: hantar segerak ke 1 nombor, TANPA cipta campaign ---
  if (test) {
    if (!testNumber) return NextResponse.json({ error: "Masukkan nombor test." }, { status: 400 });
    const p = { ...params };
    for (const key of ["nama", "name"]) if (key in p && (!p[key] || !p[key].trim())) p[key] = "pelanggan";
    const res = await sendTemplate(formatWaPhone(testNumber), templateName, templateLang, p, headerMedia, sender);
    return NextResponse.json({ ok: res.ok, sent: res.ok ? 1 : 0, failed: res.ok ? 0 : 1, error: res.error });
  }

  // --- Resolusi penerima (resolver tunggal — preview guna fungsi yang SAMA) ---
  const recipients = await resolveAudience(sb, audience);
  if (recipients.length === 0) return NextResponse.json({ error: "Tiada penerima." }, { status: 400 });
  if (recipients.length > 5000) return NextResponse.json({ error: "Terlalu ramai penerima (max 5000)." }, { status: 400 });

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
      header_video: headerVideo || null,
      phone_number_id: phoneNumberId || null,
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
