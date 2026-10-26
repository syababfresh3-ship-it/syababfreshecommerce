// ============================================================
// lib/ai/gift-knowledge — chatbot WA tahu tentang Custom Gift Box Kurma (korporat) & kurma borong.
// Fasa 3 docs/plan-ai-chatbot-cerdik.md. SEMUA fakta dari sumber awam sedia ada (tiada rekaan):
//  • GIFT_FAQ, GIFT_CLIENTS, GIFT_WA_TEXT  (lib/gift-copy.ts — dipapar di LP)
//  • COMPANY.depositPct / leadTimeWeeks     (lib/company.ts)
//  • FINISHES, KURMA sheet 2026 + sheetQuote (lib/gift.ts, lib/gift-pricing.ts — kalkulator awam Studio)
// Tool: gift_price_estimate (anggaran = harga senarai kalkulator awam) · flag_gift_enquiry (→ gift_orders
// status 'enquiry', config.source='wa-ai' → peti Enquiry Gift → team sales buat sebut harga).
// ============================================================
import type { AiToolDef } from "./tools";
import { GIFT_FAQ, GIFT_CLIENTS } from "@/lib/gift-copy";
import { COMPANY } from "@/lib/company";
import { FINISHES, DEFAULT_DEPOSIT_PCT } from "@/lib/gift";
import { KURMA, SHEET_WEIGHTS, sheetPriceRange, sheetQuote, type SheetWeight } from "@/lib/gift-pricing";
import { kurmaAbs } from "@/lib/kurma-host";
import { sendAdminPush } from "@/lib/push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export const GIFT_LINKS = {
  studio: kurmaAbs("/studio"),
  korporat: kurmaAbs("/korporat"),
  portfolio: kurmaAbs("/portfolio"),
  borong: kurmaAbs("/borong"),
};

/** Teks statik untuk system prompt (cacheable). */
export function buildGiftKnowledge(): string {
  const r = sheetPriceRange();
  const kurma = KURMA.map((k) => `${k.name}${k.note ? ` (${k.note})` : ""}`).join("; ");
  const faq = GIFT_FAQ.map((f) => `S: ${f.q}\nJ: ${f.a}`).join("\n");
  return `## Gift Box Kurma Custom (korporat / agensi / majlis) — kami buat ini
- Apa: kotak hadiah kurma dengan design & logo klien (design percuma, klien sahkan mockup sebelum cetak). Harga termasuk kurma + kotak custom; penghantaran dikira berasingan.
- Pilihan kurma (sheet 2026): ${kurma}. Berat isi: ${SHEET_WEIGHTS.join(", ")}. Finishing kotak: ${FINISHES.map((f) => f.label).join(", ")}.
- Kuantiti minimum ${r.minQty} kotak; lagi banyak lagi murah seunit. Julat harga senarai kalkulator awam: RM${r.low.toFixed(2)}–RM${r.high.toFixed(2)} sekotak ikut kurma/berat/kuantiti — guna tool gift_price_estimate untuk angka, dan SENTIASA sebut "anggaran".
- Proses: sebut harga percuma (team sales) → klien sahkan & deposit ${COMPANY.depositPct}% → design/mockup disahkan → produksi ~${COMPANY.leadTimeWeeks} minggu bekerja → hantar (seluruh Malaysia, boleh berbilang alamat) → baki selepas siap. Sebut harga & invois rasmi atas nama ${COMPANY.legalName}.
- Pernah dipercayai oleh (dipapar di LP kami): ${GIFT_CLIENTS.join(", ")}.
- Pautan: design sendiri & kira harga di Studio ${GIFT_LINKS.studio} · maklumat korporat ${GIFT_LINKS.korporat} · portfolio ${GIFT_LINKS.portfolio}.
- Kurma BORONG (karton 3–5kg untuk kedai, bazar, masjid, ejen): ada — harga ikut kuantiti & musim dari team sales; pautan ${GIFT_LINKS.borong}. Rekod juga dengan flag_gift_enquiry (nyatakan "borong" dalam notes).
- Nombor team gift/korporat: ${COMPANY.phoneKurma.display}.
FAQ gift box (dari LP):
${faq}`;
}

/** Peraturan tingkah laku untuk topik gift (ditambah ke prompt WA). */
export const GIFT_RULES = `GIFT BOX KURMA / HADIAH KORPORAT (penting):
- Bila customer tanya gift box, hadiah korporat, door gift, hadiah Ramadan/Raya berlogo, kotak kurma custom, atau kurma borong: ini perkhidmatan kami — jawab yakin dari bahagian "Gift Box Kurma" di bawah. Jangan kata kami tak buat.
- Anggaran harga: guna tool gift_price_estimate (kurma, berat, kuantiti). Balas dalam bentuk ini sahaja: satu baris harga per kotak + jumlah + "(termasuk kotak berlogo, tanpa penghantaran)", satu ayat "ini anggaran senarai; harga rasmi dari sebut harga team sales", kemudian SATU soalan untuk teruskan. Jangan huraikan design percuma/finishing/deposit kecuali ditanya. JANGAN reka harga atau diskaun gift.
- Kumpul satu-satu, jangan tanya semua sekali gus: (a) nama syarikat/organisasi & nama PIC, (b) anggaran kuantiti, (c) jenis kurma & berat (atau biar team cadang), (d) tarikh perlu / majlis, (e) kawasan hantar, (f) ada logo/design atau perlu kami reka.
- Bila cukup sekurang-kurangnya nama/syarikat + anggaran kuantiti, panggil flag_gift_enquiry SEKALI (sertakan semua yang dikumpul). Jangan panggil semula atau ulang sebut "enquiry direkod" pada giliran seterusnya kecuali customer beri butiran baru. Kemudian balas 2 baris sahaja: enquiry direkod + team sales hubungi dengan sebut harga rasmi dalam masa bekerja. Pautan Studio hanya bila customer nak design/tengok harga sendiri.
- JANGAN ambil deposit atau beri no. akaun untuk gift, JANGAN janji tarikh siap tepat (sebut ~2 minggu bekerja selepas design & bayaran disahkan), JANGAN panggil flag_ready_order untuk gift (itu untuk order buah runcit).`;

// ── Tool ──────────────────────────────────────────────────────────────────
export const GIFT_TOOLS: AiToolDef[] = [
  {
    name: "gift_price_estimate",
    description:
      "ANGGARAN harga senarai Custom Gift Box Kurma (sama seperti kalkulator awam Studio, sheet 2026): pilih kurma (Ajwa AA / Ajwa AA Premium / Mariami A / Mariami AA / Safawi A), berat isi (100g/200g/500g) dan kuantiti kotak. Pulang harga per kotak & jumlah (termasuk kurma + kotak berlogo, TANPA penghantaran) + tier minimum. Sentiasa beritahu customer ini anggaran; harga rasmi dari sebut harga team sales.",
    parameters: {
      type: "object",
      properties: {
        kurma: { type: "string", description: 'Jenis kurma, cth "ajwa", "ajwa premium", "mariami", "mariami aa", "safawi". Kosong = Ajwa AA.' },
        weight: { type: "string", enum: ["100g", "200g", "500g"], description: "Berat isi kurma per kotak." },
        qty: { type: "integer", description: "Bilangan kotak (minimum biasanya 50; 500g bermula 500)." },
      },
      required: ["weight", "qty"],
    },
  },
  {
    name: "flag_gift_enquiry",
    description:
      "Rekod enquiry Gift Box Kurma / kurma borong dari customer ini ke peti Enquiry Gift supaya team sales buat sebut harga rasmi. Panggil bila dah ada sekurang-kurangnya nama/syarikat + anggaran kuantiti. Sertakan semua butiran yang dikumpul (kurma, berat, tarikh perlu, kawasan hantar, logo, bajet, nota). Selepas ini beritahu customer team sales akan hubungi.",
    parameters: {
      type: "object",
      properties: {
        organisation: { type: "string", description: "Nama syarikat / organisasi / majlis." },
        contact_name: { type: "string", description: "Nama PIC (jika diberi)." },
        est_qty: { type: "integer", description: "Anggaran bilangan kotak (atau kg/karton untuk borong)." },
        kurma_pref: { type: "string", description: 'Pilihan kurma, cth "Ajwa AA" (kosong kalau minta cadangan).' },
        weight_pref: { type: "string", description: 'Berat isi, cth "200g".' },
        needed_by: { type: "string", description: "Tarikh perlu (YYYY-MM-DD) atau teks seperti 'sebelum Ramadan'." },
        delivery_area: { type: "string", description: "Bandar/negeri hantar (atau berbilang alamat)." },
        has_logo: { type: "boolean", description: "Customer ada logo/design sedia?" },
        budget: { type: "string", description: "Bajet jika disebut, cth 'RM15 sekotak'." },
        notes: { type: "string", description: "Nota lain, termasuk 'borong' jika kurma borong karton." },
      },
      required: ["est_qty"],
    },
  },
];

const norm = (s: unknown) => String(s ?? "").toLowerCase().trim();
function kurmaIdFor(input: unknown): string {
  const t = norm(input);
  if (!t) return "ajwa-aa";
  if (t.includes("ajwa") && t.includes("premium")) return "ajwa-aa-premium";
  if (t.includes("ajwa")) return "ajwa-aa";
  if (t.includes("mariami") && /\baa\b/.test(t)) return "mariami-aa";
  if (t.includes("mariami")) return "mariami-a";
  if (t.includes("safawi")) return "safawi-a";
  return "";
}
const rm = (n: number) => `RM${n.toFixed(2)}`;

export function giftPriceEstimate(input: Record<string, unknown>): string {
  const id = kurmaIdFor(input.kurma);
  const options = KURMA.map((k) => `${k.name}: ${Object.keys(k.w).join("/")}`).join("; ");
  if (!id) return `Jenis kurma "${String(input.kurma ?? "")}" tiada dalam sheet gift. Pilihan: ${options}. Untuk kurma lain, team sales sebut harga manual.`;
  const q = sheetQuote({ kurmaId: id, weight: input.weight, qty: Number(input.qty) });
  if (!q.ok) return `${q.error}. Pilihan berat ikut kurma: ${options}.`;
  return JSON.stringify({
    kurma: q.kurma.name, berat: q.weight, kuantiti_diminta: q.requestedQty,
    ...(q.clamped ? { kuantiti_dikira: q.qty, nota_tier: `Harga ini untuk minimum ${q.minTier} kotak; bawah itu team sales sebut harga manual.` } : {}),
    anggaran_per_kotak: rm(q.perBox), anggaran_jumlah: rm(q.total),
    termasuk: "kurma + kotak custom berlogo (design percuma)", tidak_termasuk: "penghantaran",
    deposit: `${DEFAULT_DEPOSIT_PCT}% selepas sebut harga & design disahkan`,
    nota: "ANGGARAN harga senarai kalkulator awam (sheet 2026). Harga rasmi dalam sebut harga team sales — boleh berbeza ikut design, finishing & penghantaran.",
    studio: GIFT_LINKS.studio,
  });
}

export interface GiftEnquiryCtx { waId: string; phone?: string | null; name?: string | null; contactId?: string | null; conversationId?: string | null; dryRun?: boolean }
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const MISSING_COLUMN = new Set(["42703", "PGRST204"]);

export async function flagGiftEnquiry(sb: SB, ctx: GiftEnquiryCtx, input: Record<string, unknown>): Promise<string> {
  const estQty = Math.floor(Number(input.est_qty));
  if (!Number.isFinite(estQty) || estQty < 1) return "GAGAL: anggaran kuantiti diperlukan (nombor). Tanya customer berapa kotak.";
  const organisation = str(input.organisation, 160) || null;
  const contactName = str(input.contact_name, 120) || ctx.name || "Customer WhatsApp";
  const details = {
    kurma_pref: str(input.kurma_pref, 80) || null, weight_pref: str(input.weight_pref, 20) || null,
    needed_by: str(input.needed_by, 60) || null, delivery_area: str(input.delivery_area, 160) || null,
    has_logo: typeof input.has_logo === "boolean" ? input.has_logo : null, budget: str(input.budget, 80) || null, notes: str(input.notes, 1000) || null,
  };
  const summary = [
    `[Enquiry gift via WhatsApp AI]`, organisation ? `Organisasi: ${organisation}` : null, `PIC: ${contactName}`, `Anggaran: ${estQty} kotak`,
    details.kurma_pref ? `Kurma: ${details.kurma_pref}${details.weight_pref ? ` · ${details.weight_pref}` : ""}` : details.weight_pref ? `Berat: ${details.weight_pref}` : null,
    details.needed_by ? `Perlu: ${details.needed_by}` : null, details.delivery_area ? `Hantar: ${details.delivery_area}` : null,
    details.has_logo === null ? null : `Logo: ${details.has_logo ? "ada" : "perlu reka"}`, details.budget ? `Bajet: ${details.budget}` : null, details.notes ? `Nota: ${details.notes}` : null,
  ].filter(Boolean).join("\n");
  if (ctx.dryRun) return `BERJAYA (mod ujian): enquiry gift direkod untuk team sales.\n${summary}`;

  const phone = (ctx.phone || ctx.waId || "").toString();
  // Dedup 24j: enquiry WA-AI sedia ada untuk nombor ini yang masih 'enquiry' → kemas kini, bukan gandakan.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: recent } = await sb.from("gift_orders").select("id, order_number, config").eq("phone", phone).eq("status", "enquiry").gte("created_at", since).order("created_at", { ascending: false }).limit(5);
  const existing = (recent ?? []).find((r: { config?: { source?: string } }) => r.config?.source === "wa-ai");
  const config = { source: "wa-ai", organisation, est_qty: estQty, ...details, wa_id: ctx.waId, conversation_id: ctx.conversationId ?? null };
  let orderId: string, orderNumber: string;
  if (existing) {
    await sb.from("gift_orders").update({ company: organisation ?? undefined, quantity: estQty, config: { ...(existing.config ?? {}), ...config }, notes: summary, updated_at: new Date().toISOString() }).eq("id", existing.id);
    orderId = existing.id; orderNumber = existing.order_number;
  } else {
    const { data: num } = await sb.rpc("generate_gift_order_number");
    const row: Record<string, unknown> = {
      order_number: num, channel: "online", name: contactName, phone, email: null, company: organisation, delivery_method: "delivery",
      config, quantity: estQty, unit_price: 0, subtotal: 0, delivery_fee: 0, total: 0, deposit_pct: DEFAULT_DEPOSIT_PCT, deposit_amount: 0, balance: 0,
      payment_status: "unpaid", status: "enquiry", notes: summary,
    };
    let res = await sb.from("gift_orders").insert(row).select("id, order_number").single();
    if (res.error && MISSING_COLUMN.has(res.error.code ?? "")) { delete row.channel; res = await sb.from("gift_orders").insert(row).select("id, order_number").single(); }
    if (res.error || !res.data) return `GAGAL rekod enquiry (${res.error?.message ?? "?"}). Beritahu customer team sales akan hubungi — dan minta mereka WhatsApp ${COMPANY.phoneKurma.display} jika perlu segera.`;
    orderId = res.data.id; orderNumber = res.data.order_number;
  }
  if (ctx.conversationId) await sb.from("wa_conversations").update({ needs_reply: true }).eq("id", ctx.conversationId).then(() => {}, () => {});
  await sendAdminPush({ title: `Enquiry gift (WA AI) — ${organisation ?? contactName}`, body: `${estQty} kotak${details.kurma_pref ? ` · ${details.kurma_pref}` : ""}${details.needed_by ? ` · perlu ${details.needed_by}` : ""} · ${orderNumber}`, url: `/admin/kurma/${orderId}`, tag: "gift-enquiry" }).catch(() => {});
  return `BERJAYA: enquiry ${orderNumber} direkod ke peti Enquiry Gift; team sales akan sediakan sebut harga rasmi. Beritahu customer: terima kasih, team kami akan hubungi dalam masa bekerja dengan sebut harga; boleh juga design sendiri di ${GIFT_LINKS.studio}.`;
}

/** Pulang null kalau bukan tool gift. */
export async function runGiftTool(sb: SB, ctx: GiftEnquiryCtx, name: string, input: Record<string, unknown>): Promise<string | null> {
  if (name === "gift_price_estimate") return giftPriceEstimate(input);
  if (name === "flag_gift_enquiry") return flagGiftEnquiry(sb, ctx, input);
  return null;
}
// Pastikan jenis SheetWeight kekal dirujuk (enum tool selari dengan SHEET_WEIGHTS).
export type { SheetWeight };
