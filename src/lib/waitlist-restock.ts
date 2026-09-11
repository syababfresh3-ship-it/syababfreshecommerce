// ============================================================
// waitlist-restock — pembina notis restock satu-klik (Sprint 3 G).
//
// planRestock    = BACA SAHAJA: produk + stok + penerima (WA vs e-mel) + kiraan
//                  + lalai (mesej, nombor WA, template restock terakhir).
//                  Dipakai mod `dry` API & skrip semak — TIADA tulisan/hantaran.
// executeRestock = tulis: cipta kempen crm_blasts + penerima dengan BENTUK YANG
//                  SAMA seperti wizard (/api/whatsapp/blast POST) → kick drainer,
//                  hantar e-mel (zeptomail.sendRestockEmail), tanda
//                  product_waitlist.notified_at (+ notified_via/blast_id).
//
// Polisi saluran:
//   - WA hanya ke nombor yang TIDAK dalam crm_suppressions / wa_contacts.opt_out —
//     penapis yang SAMA dengan Blaster (resolveAudience). Tiada saluran WA baru;
//     ini mekanisme yang staf guna manual sebelum ni (salin nombor → wizard).
//   - E-mel dicari dari profiles.email (user_id) atau customers.email (phone_norm,
//     consent_email ≠ false). Entri yang ada e-mel terima KEDUA-DUA WA + e-mel.
// Idempotent: hanya baris notified_at IS NULL dipilih; tanda guard .is(null).
// Toleran migration 129 belum jalan (42703 / PGRST204 → notified_at sahaja).
// ============================================================
import { resolveAudience } from "@/lib/blast-audience";
import { drainBlasts } from "@/lib/blast-drain";
import { formatWaPhone } from "@/lib/whatsapp-cloud";
import { sendRestockEmail } from "@/lib/zeptomail";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { buildDefaultRestockMessage, classifyParamKey, renderRestockMessage } from "@/lib/waitlist-restock-message";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const MISSING = new Set(["42703", "PGRST204"]); // lajur belum wujud (migration 129)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CHUNK = 500;

interface WaitlistRow { id: string; phone: string; name: string | null; user_id: string | null; created_at: string }

export interface RestockRecipient {
  rowId: string;
  phone: string;          // 60xxxxxxxxx (formatWaPhone — sama dengan wa_id Blaster)
  name: string | null;
  email: string | null;   // profiles.email (user_id) → customers.email (phone_norm)
  wa: boolean;            // layak WA (nombor sah & tidak disekat)
  suppressed: boolean;    // nombor sah tapi dalam crm_suppressions / opt_out
}

export interface RestockPlan {
  product: { id: string; name: string; slug: string; image_url: string | null; is_active: boolean; url: string };
  stock: { available: number | null; hasVariants: boolean; source: "product_stock_all" | "product_stock" | "none" };
  recipients: RestockRecipient[];
  counts: { pending: number; wa: number; email: number; both: number; suppressed: number; noChannel: number };
  campaign: { name: string; total: number }; // kempen WA yang BAKAL dicipta
  defaults: {
    message: string;
    waNumbers: { phone_number_id: string; display_name: string; is_default: boolean }[];
    lastRestock: { template_name: string; template_lang: string; phone_number_id: string | null; header_image: string | null } | null;
  };
}

export interface RestockInput {
  message: string;
  channels: { wa: boolean; email: boolean };
  templateName?: string;
  templateLang?: string;
  params?: Record<string, string>;
  headerImage?: string | null;
  headerVideo?: string | null;
  phoneNumberId?: string | null;
  createdBy: string | null;
  drainBudgetMs?: number;
}

export interface RestockResult {
  blastId: string | null;
  counts: { waQueued: number; waSentNow: number; emailSent: number; emailFailed: number; marked: number; skipped: number };
}

export type RestockError = { error: string; status: number };

export function productUrlFor(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://shop.syababfresh.my").replace(/\/$/, "");
  return `${base}/products/${slug}`;
}

// ── stok: product_stock_all (batch + varian) → fallback product_stock ─────────
async function readStock(sb: SB, productId: string): Promise<RestockPlan["stock"]> {
  const a = await sb.from("product_stock_all").select("available_stock, has_variants").eq("product_id", productId).maybeSingle();
  if (!a.error && a.data) {
    return { available: Number(a.data.available_stock ?? 0), hasVariants: !!a.data.has_variants, source: "product_stock_all" };
  }
  const b = await sb.from("product_stock").select("available_stock").eq("product_id", productId).maybeSingle();
  if (!b.error && b.data) return { available: Number(b.data.available_stock ?? 0), hasVariants: false, source: "product_stock" };
  return { available: null, hasVariants: false, source: "none" };
}

// ── e-mel: profiles (user_id) dulu, kemudian customers (phone_norm) ───────────
async function resolveEmails(sb: SB, rows: WaitlistRow[]): Promise<Map<string, string>> {
  const byRow = new Map<string, string>();
  const clean = (e: unknown): string | null => {
    const s = String(e ?? "").trim().toLowerCase();
    return EMAIL_RE.test(s) ? s : null;
  };

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((u): u is string => !!u))];
  const byUser = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const { data } = await sb.from("profiles").select("id, email").in("id", userIds.slice(i, i + CHUNK));
    for (const p of (data ?? []) as { id: string; email: string | null }[]) {
      const e = clean(p.email);
      if (e) byUser.set(p.id, e);
    }
  }
  for (const r of rows) {
    const e = r.user_id ? byUser.get(r.user_id) : undefined;
    if (e) byRow.set(r.id, e);
  }

  const phones = [...new Set(rows.filter((r) => !byRow.has(r.id)).map((r) => formatWaPhone(r.phone)))];
  const byPhone = new Map<string, string>();
  for (let i = 0; i < phones.length; i += CHUNK) {
    const { data } = await sb.from("customers").select("phone_norm, email, consent_email").in("phone_norm", phones.slice(i, i + CHUNK));
    for (const c of (data ?? []) as { phone_norm: string; email: string | null; consent_email: boolean | null }[]) {
      if (c.consent_email === false) continue; // hormati opt-out e-mel eksplisit
      const e = clean(c.email);
      if (e) byPhone.set(c.phone_norm, e);
    }
  }
  for (const r of rows) {
    if (byRow.has(r.id)) continue;
    const e = byPhone.get(formatWaPhone(r.phone));
    if (e) byRow.set(r.id, e);
  }
  return byRow;
}

// ── pelan (baca sahaja) ───────────────────────────────────────────────────────
export async function planRestock(sb: SB, productId: string): Promise<RestockPlan | RestockError> {
  const { data: product } = await sb
    .from("products")
    .select("id, name, slug, image_url, is_active")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { error: "Produk tidak dijumpai.", status: 404 };
  const url = productUrlFor(product.slug as string);

  const [stock, rows, waNumbersRes, lastRes] = await Promise.all([
    readStock(sb, productId),
    fetchAll<WaitlistRow>((from, to) =>
      sb.from("product_waitlist")
        .select("id, phone, name, user_id, created_at")
        .eq("product_id", productId)
        .is("notified_at", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "waitlist-restock"),
    sb.from("wa_numbers").select("phone_number_id, display_name, is_default").eq("is_active", true).order("created_at"),
    sb.from("crm_blasts")
      .select("template_name, template_lang, phone_number_id, header_image")
      .ilike("name", "Restock:%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Kelayakan WA — penapis SAMA dengan Blaster (format, sah, suppression, opt-out).
  const eligible = new Set<string>();
  if (rows.length) {
    const aud = await resolveAudience(sb, {
      source: "csv",
      rows: rows.map((r) => ({ phone: r.phone, name: r.name ?? undefined })),
    });
    for (const a of aud) eligible.add(a.wa_id);
  }
  const emails = rows.length ? await resolveEmails(sb, rows) : new Map<string, string>();

  const recipients: RestockRecipient[] = rows.map((r) => {
    const phone = formatWaPhone(r.phone);
    const valid = phone.replace(/\D/g, "").length >= 8;
    const wa = eligible.has(phone);
    return { rowId: r.id, phone, name: r.name, email: emails.get(r.id) ?? null, wa, suppressed: valid && !wa };
  });

  const counts = {
    pending: recipients.length,
    wa: recipients.filter((r) => r.wa).length,
    email: recipients.filter((r) => !!r.email).length,
    both: recipients.filter((r) => r.wa && !!r.email).length,
    suppressed: recipients.filter((r) => r.suppressed).length,
    noChannel: recipients.filter((r) => !r.wa && !r.email).length,
  };

  return {
    product: { id: product.id, name: product.name, slug: product.slug, image_url: product.image_url ?? null, is_active: !!product.is_active, url },
    stock,
    recipients,
    counts,
    campaign: { name: `Restock: ${product.name}`, total: counts.wa },
    defaults: {
      message: buildDefaultRestockMessage(product.name as string, url),
      waNumbers: (waNumbersRes.data ?? []) as RestockPlan["defaults"]["waNumbers"],
      lastRestock: (lastRes.data ?? null) as RestockPlan["defaults"]["lastRestock"],
    },
  };
}

// ── tanda notified (toleran lajur 129 belum wujud) ────────────────────────────
async function markRows(sb: SB, ids: string[], via: string, blastId: string | null): Promise<number> {
  const now = new Date().toISOString();
  let n = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    let res = await sb
      .from("product_waitlist")
      .update({ notified_at: now, notified_via: via, notified_blast_id: blastId }, { count: "exact" })
      .in("id", chunk)
      .is("notified_at", null);
    if (res.error && MISSING.has(res.error.code ?? "")) {
      res = await sb.from("product_waitlist").update({ notified_at: now }, { count: "exact" }).in("id", chunk).is("notified_at", null);
    }
    if (res.error) console.error("[waitlist-restock] tanda notified gagal:", res.error.message);
    else n += res.count ?? 0;
  }
  return n;
}

// Butang manual "Dah maklum" — semua entri belum-notified satu produk.
export async function markProductWaitlistNotified(
  sb: SB,
  productId: string,
  via = "manual",
): Promise<{ marked: number; error: string | null }> {
  const now = new Date().toISOString();
  let res = await sb
    .from("product_waitlist")
    .update({ notified_at: now, notified_via: via }, { count: "exact" })
    .eq("product_id", productId)
    .is("notified_at", null);
  if (res.error && MISSING.has(res.error.code ?? "")) {
    res = await sb.from("product_waitlist").update({ notified_at: now }, { count: "exact" }).eq("product_id", productId).is("notified_at", null);
  }
  return { marked: res.count ?? 0, error: res.error?.message ?? null };
}

// ── laksana (tulis + hantar) ──────────────────────────────────────────────────
export async function executeRestock(sb: SB, plan: RestockPlan, input: RestockInput): Promise<RestockResult | RestockError> {
  const waTargets = input.channels.wa ? plan.recipients.filter((r) => r.wa) : [];
  const emailTargets = input.channels.email ? plan.recipients.filter((r) => !!r.email) : [];
  if (!waTargets.length && !emailTargets.length) return { error: "Tiada penerima untuk saluran dipilih.", status: 400 };
  if (waTargets.length && !input.templateName?.trim()) return { error: "Pilih template WhatsApp diluluskan untuk saluran WA.", status: 400 };
  if (waTargets.length > 5000) return { error: "Terlalu ramai penerima WA (max 5000).", status: 400 };
  if (emailTargets.length && !input.message.trim()) return { error: "Mesej e-mel kosong.", status: 400 };

  // Param statik kempen — isi defensif kunci produk/link yang kosong (sama macam sheet).
  const params: Record<string, string> = { ...(input.params ?? {}) };
  for (const k of Object.keys(params)) {
    if (params[k]?.trim()) continue;
    const kind = classifyParamKey(k);
    if (kind === "product") params[k] = plan.product.name;
    else if (kind === "link") params[k] = plan.product.url;
  }
  const nameKeys = Object.keys(params).filter((k) => classifyParamKey(k) === "name");

  // (a) Kempen Blaster — bentuk SAMA dengan /api/whatsapp/blast POST (send-now).
  let blastId: string | null = null;
  let waSentNow = 0;
  if (waTargets.length) {
    const { data: blast, error } = await sb
      .from("crm_blasts")
      .insert({
        name: plan.campaign.name,
        template_name: input.templateName!.trim(),
        template_lang: input.templateLang?.trim() || "ms",
        params,
        header_image: input.headerImage?.trim() || null,
        header_video: input.headerVideo?.trim() || null,
        phone_number_id: input.phoneNumberId?.trim() || null,
        audience: { source: "waitlist", product_id: plan.product.id, product_name: plan.product.name },
        status: "sending",
        scheduled_at: new Date().toISOString(),
        total: waTargets.length,
        created_by: input.createdBy,
      })
      .select("id")
      .single();
    if (error || !blast) return { error: `Gagal cipta kempen: ${error?.message ?? "?"}`, status: 500 };
    blastId = blast.id as string;

    // Penerima 'pending' + vars nama per penerima (drainer auto-isi nama/name;
    // vars memastikan kunci lain spt customer_name pun diisi).
    const queueRows = waTargets.map((r) => ({
      blast_id: blastId,
      wa_id: r.phone,
      name: r.name,
      vars: Object.fromEntries(nameKeys.map((k) => [k, r.name || "pelanggan"])),
      status: "pending",
    }));
    for (let i = 0; i < queueRows.length; i += CHUNK) {
      const { error: qe } = await sb.from("crm_blast_recipients").insert(queueRows.slice(i, i + CHUNK));
      if (qe) return { error: `Kempen ${blastId} dicipta tapi penerima gagal di-queue: ${qe.message}`, status: 500 };
    }

    // Kick drainer serta-merta (batch pertama keluar sekarang; baki oleh cron).
    const d = await drainBlasts(sb, { budgetMs: input.drainBudgetMs ?? 20_000, blastId });
    waSentNow = d.sent;
  }

  // (b) E-mel — satu per alamat (dua entri kongsi e-mel → hantar sekali, dua-dua ditanda).
  const emailed = new Set<string>();
  const seen = new Map<string, boolean>();
  let emailSent = 0;
  let emailFailed = 0;
  for (const r of emailTargets) {
    const email = r.email!;
    if (seen.has(email)) {
      if (seen.get(email)) emailed.add(r.rowId);
      continue;
    }
    const ok = await sendRestockEmail({
      to: email,
      toName: r.name,
      productName: plan.product.name,
      productUrl: plan.product.url,
      imageUrl: plan.product.image_url,
      message: renderRestockMessage(input.message, { nama: r.name, produk: plan.product.name, link: plan.product.url }),
    });
    seen.set(email, ok);
    if (ok) { emailSent++; emailed.add(r.rowId); } else emailFailed++;
  }

  // (c) Tanda notified ikut saluran sebenar yang berjaya.
  const waSet = new Set(waTargets.map((r) => r.rowId));
  const buckets: Record<"wa" | "email" | "wa+email", string[]> = { wa: [], email: [], "wa+email": [] };
  for (const r of plan.recipients) {
    const w = waSet.has(r.rowId);
    const e = emailed.has(r.rowId);
    if (!w && !e) continue;
    buckets[w && e ? "wa+email" : w ? "wa" : "email"].push(r.rowId);
  }
  let marked = 0;
  for (const via of Object.keys(buckets) as (keyof typeof buckets)[]) {
    if (buckets[via].length) marked += await markRows(sb, buckets[via], via, blastId);
  }

  return {
    blastId,
    counts: { waQueued: waTargets.length, waSentNow, emailSent, emailFailed, marked, skipped: plan.recipients.length - marked },
  };
}
