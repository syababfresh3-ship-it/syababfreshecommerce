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
import { fillTemplateParams, emptyParamKeys } from "@/lib/blast-params";
import { isGatewayNumber, gatewaySessionId, gatewaySendText } from "@/lib/wa-gateway";
import { GATEWAY_TEMPLATE_NAME, GW_BLAST_MAX_CHARS, GW_BLAST_MAX_RECIPIENTS, GW_BLAST_DAILY_CAP, renderGatewayText, enqueueGatewayBlast, clampGatewayPace } from "@/lib/blast-gateway";

// Terjemah error WhatsApp Cloud API kepada mesej yang admin faham (punca + tindakan).
function friendlyWaError(err?: string): string | null {
  if (!err) return null;
  if (/132000|131008|132012/.test(err)) return `${err} — Template perlu header (gambar/video) & param yang betul. Pastikan URL header diisi dan bilangan param padan template.`;
  if (/132001/.test(err)) return `${err} — Template tak wujud pada WABA nombor penghantar. Tukar "Hantar dari" ke nombor yang memiliki template ini.`;
  if (/131026/.test(err)) return `${err} — Nombor tak boleh terima (bukan WhatsApp aktif / belum terima ToS).`;
  if (/131047/.test(err)) return `${err} — Di luar tetingkap 24 jam — guna template diluluskan.`;
  if (/13005[0-9]|permission|OAuth|190\b/.test(err)) return `${err} — Isu token/kebenaran nombor penghantar.`;
  return err;
}

// Pautan header mesti URL TERUS ke fail awam — Meta muat turun sendiri. Pautan halaman (Drive/YouTube) pasti gagal.
function headerLinkError(link: string, kind: "image" | "video"): string | null {
  const label = kind === "video" ? "video" : "gambar";
  let u: URL;
  try { u = new URL(link); } catch { return `URL ${label} header tidak sah.`; }
  if (u.protocol !== "https:") return `URL ${label} header mesti HTTPS.`;
  const host = u.hostname.replace(/^www\./, "");
  const pageHost = /(^|\.)(drive\.google\.com|docs\.google\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|instagram\.com|vimeo\.com)$/.test(host)
    || (host === "dropbox.com" && u.searchParams.get("dl") !== "1");
  if (pageHost) return `Pautan ${host} ialah halaman web, bukan fail. Meta perlukan URL terus ke fail${kind === "video" ? " .mp4" : ""} — muat naik di Admin › Media dan salin URL.`;
  if (kind === "video" && !/\.(mp4|3gp)$/i.test(u.pathname)) return "URL video header mesti fail .mp4 (atau .3gp) — format lain tidak disokong WhatsApp.";
  return null;
}

async function auth() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, sb: null };
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { user: null, sb: null };
  return { user, sb };
}

const PER_PAGE = 20;

export async function GET(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Penapis + pagination: ?page=N (0-based), ?month=YYYY-MM (waktu MY),
  // ?number=<phone_number_id> (+&includeNull=1 utk nombor default — blast lama
  // sebelum multi-number tiada rekod nombor, dikira milik default).
  const sp = req.nextUrl.searchParams;
  const page = Math.max(0, parseInt(sp.get("page") ?? "0", 10) || 0);
  const month = (sp.get("month") ?? "").trim();
  const number = (sp.get("number") ?? "").trim();
  const includeNull = sp.get("includeNull") === "1";

  const LIST_COLS = "id, name, template_name, status, total, sent, failed, scheduled_at, created_at, phone_number_id";
  type BlastRow = { id: string; name: string; template_name: string; status: string; total: number | null; sent: number | null; failed: number | null; scheduled_at: string | null; created_at: string; phone_number_id: string | null; channel?: string | null };
  const listQuery = async (cols: string) => {
    let q = sb
      .from("crm_blasts")
      .select(cols, { count: "exact" })
      .order("created_at", { ascending: false });
    if (/^\d{4}-\d{2}$/.test(month)) {
      const start = new Date(`${month}-01T00:00:00+08:00`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      q = q.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    }
    if (number) {
      q = includeNull ? q.or(`phone_number_id.eq.${number},phone_number_id.is.null`) : q.eq("phone_number_id", number);
    }
    const r = await q.range(page * PER_PAGE, (page + 1) * PER_PAGE - 1);
    return { data: (r.data as unknown as BlastRow[] | null), count: r.count, error: r.error };
  };
  // `channel` (official|gateway) datang dari migration 164 — kalau lajur belum wujud (42703), ulang tanpa lajur itu supaya senarai tetap keluar.
  const first = await listQuery(`${LIST_COLS}, channel`);
  const { data: blasts, count } = first.error?.code === "42703" ? await listQuery(LIST_COLS) : first;

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

  // Reply per kempen (additive — view crm_blast_replies, lihat 103).
  const { data: replyRows } = ids.length
    ? await sb.from("crm_blast_replies").select("blast_id, replies").in("blast_id", ids)
    : { data: [] as { blast_id: string; replies: number }[] };
  const repMap = new Map((replyRows ?? []).map((r: { blast_id: string; replies: number }) => [r.blast_id, r.replies]));

  const withProgress = (blasts ?? []).map((b) => ({
    ...b,
    progress: pMap.get(b.id) ?? { total: b.total ?? 0, pending: 0, sent: b.sent ?? 0, delivered: 0, read: 0, failed: b.failed ?? 0 },
    roas: rMap.get(b.id) ?? null,
    replies: repMap.get(b.id) ?? 0,
  }));

  // Stats dashboard (semua campaign).
  const { data: ov } = await sb.rpc("crm_blaster_overview");
  const stats = Array.isArray(ov) ? ov[0] : ov;

  // Totals SEMUA campaign (kad revenue/order/ROAS) — jangan kira dari page
  // semasa sahaja, nanti angka mengecil bila berpagination.
  const { data: roasAll } = await sb.from("crm_blast_roas").select("revenue, orders_attributed, cost").limit(1000);
  const totals = (roasAll ?? []).reduce(
    (t, r: { revenue: number | null; orders_attributed: number | null; cost: number | null }) => ({
      revenue: t.revenue + Number(r.revenue ?? 0),
      orders: t.orders + Number(r.orders_attributed ?? 0),
      cost: t.cost + Number(r.cost ?? 0),
    }),
    { revenue: 0, orders: 0, cost: 0 },
  );

  return NextResponse.json({ blasts: withProgress, stats: stats ?? null, totals, count: count ?? 0, perPage: PER_PAGE });
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
    message,
    gwDailyCap,
    gwGapSec,
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
    message?: string;   // kempen gateway (nombor tidak rasmi): teks bebas, bukan template
    gwDailyCap?: number; // gateway: berapa nombor sehari (5–140)
    gwGapSec?: number;   // gateway: jarak antara mesej dalam saat (20–600)
  };
  // Header media: video diutamakan (objek), kalau tidak fallback gambar (string).
  const headerMedia = headerVideo ? ({ type: "video" as const, link: headerVideo }) : headerImage;

  // ---------- Cabang GATEWAY (nombor tidak rasmi, cth Hijau): teks bebas → wa_outbox perlahan. Laluan Official di bawah tidak disentuh. ----------
  if (isGatewayNumber(phoneNumberId)) {
    const sessionId = gatewaySessionId(phoneNumberId!);
    const text = (message ?? "").trim();
    if (!text) return NextResponse.json({ error: "Tulis mesej untuk blast nombor tidak rasmi." }, { status: 400 });
    if (text.length > GW_BLAST_MAX_CHARS) return NextResponse.json({ error: `Mesej terlalu panjang (maks ${GW_BLAST_MAX_CHARS} aksara).` }, { status: 400 });
    if (test) {
      if (!testNumber) return NextResponse.json({ error: "Masukkan nombor test." }, { status: 400 });
      const res = await gatewaySendText(sessionId, formatWaPhone(testNumber), renderGatewayText(text, { name: null }));
      return NextResponse.json({ ok: res.ok, id: res.id ?? null, sent: res.ok ? 1 : 0, failed: res.ok ? 0 : 1, error: res.ok ? null : `${res.error}${res.code ? ` (${res.code})` : ""}` });
    }
    const recipients = await resolveAudience(sb, audience);
    if (recipients.length === 0) return NextResponse.json({ error: "Tiada penerima." }, { status: 400 });
    if (recipients.length > GW_BLAST_MAX_RECIPIENTS) return NextResponse.json({ error: `Terlalu ramai penerima untuk nombor tidak rasmi (maks ${GW_BLAST_MAX_RECIPIENTS}; ${GW_BLAST_DAILY_CAP} sehari).` }, { status: 400 });
    const schedMs = scheduledAt ? new Date(scheduledAt).getTime() : 0;
    const startAt = Number.isFinite(schedMs) && schedMs > Date.now() ? schedMs : Date.now();
    const pace = clampGatewayPace({ dailyCap: gwDailyCap, gapSec: gwGapSec });   // admin pilih; dikekang 5–140/hari, 20–600s
    const { data: blast, error: bErr } = await sb
      .from("crm_blasts")
      .insert({
        name: name || `Blast Hijau ${new Date().toLocaleDateString("ms-MY")}`,
        template_name: GATEWAY_TEMPLATE_NAME, template_lang: "ms", params: { gw_daily_cap: pace.dailyCap, gw_gap_sec: pace.gapMs / 1000 }, channel: "gateway", message: text,
        phone_number_id: phoneNumberId, audience, status: "sending", scheduled_at: new Date(startAt).toISOString(),
        total: recipients.length, created_by: user.id,
      })
      .select("id")
      .single();
    if (bErr || !blast) return NextResponse.json({ error: `Gagal cipta kempen: ${bErr?.message ?? "?"} — pastikan migration 164 dijalankan.` }, { status: 500 });
    const blastId = blast.id as string;
    const queueRows = recipients.map((r) => ({ blast_id: blastId, wa_id: r.wa_id, name: r.name, vars: r.vars ?? {}, status: "pending" }));
    const inserted: { id: string; wa_id: string; name: string | null; vars: Record<string, string> | null }[] = [];
    for (let i = 0; i < queueRows.length; i += 500) {
      const { data } = await sb.from("crm_blast_recipients").insert(queueRows.slice(i, i + 500)).select("id, wa_id, name, vars");
      inserted.push(...((data ?? []) as typeof inserted));
    }
    const [{ data: opted }, { data: supp }] = await Promise.all([
      sb.from("wa_contacts").select("wa_id").eq("opt_out", true),
      sb.from("crm_suppressions").select("wa_id"),
    ]);
    const blocked = new Set([...(opted ?? []), ...(supp ?? [])].map((o: { wa_id: string }) => o.wa_id));
    const q = await enqueueGatewayBlast(sb, { blastId, sessionId, message: text, recipients: inserted, startAt, blocked, dailyCap: pace.dailyCap, gapMs: pace.gapMs });
    return NextResponse.json({ ok: true, blastId, total: recipients.length, gateway: true, dailyCap: pace.dailyCap, gapSec: pace.gapMs / 1000, queued: q.queued, skipped: q.skipped, firstAt: q.firstAt ? new Date(q.firstAt).toISOString() : null, lastAt: q.lastAt ? new Date(q.lastAt).toISOString() : null });
  }

  if (!templateName) return NextResponse.json({ error: "templateName diperlukan." }, { status: 400 });
  if (headerVideo) { const e = headerLinkError(headerVideo, "video"); if (e) return NextResponse.json({ error: e }, { status: 400 }); }
  else if (headerImage) { const e = headerLinkError(headerImage, "image"); if (e) return NextResponse.json({ error: e }, { status: 400 }); }

  // Multi-number: hantar dari nombor dipilih (lalai = env default).
  const sender = await getSender(sb, phoneNumberId);

  // --- Test: hantar segerak ke 1 nombor, TANPA cipta campaign ---
  if (test) {
    if (!testNumber) return NextResponse.json({ error: "Masukkan nombor test." }, { status: 400 });
    // Sama seperti drainer: nama/name/"1" kosong → "pelanggan" (test tiada nama penerima); token {nama} diganti.
    const p = fillTemplateParams(params, { name: null });
    const empties = emptyParamKeys(p);
    if (empties.length) return NextResponse.json({ ok: false, sent: 0, failed: 1, error: `Param kosong: ${empties.join(", ")} — Meta tolak param kosong. Isi nilai atau token {nama}.` });
    const res = await sendTemplate(formatWaPhone(testNumber), templateName, templateLang, p, headerMedia, sender);
    // ok = Graph TERIMA permintaan (bukan jaminan delivered). id = wamid utk jejak.
    return NextResponse.json({ ok: res.ok, id: res.id ?? null, sent: res.ok ? 1 : 0, failed: res.ok ? 0 : 1, error: friendlyWaError(res.error) });
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
