// ============================================================
// lib/ai/product-knowledge-fields — bahagian PURE (client-safe) pengetahuan buah:
// medan tetap, jenis, pembersih input. Diimport oleh UI admin & lib server.
// Tiada import SDK AI / Supabase di sini.
// ============================================================
export const FACT_FIELDS = [
  { key: "asal", label: "Asal", hint: "Negara / kawasan. Isi hanya jika pasti." },
  { key: "musim", label: "Musim", hint: "Bila biasanya ada / pre-order." },
  { key: "rasa", label: "Rasa", hint: "Manis, masam-manis, wangi…" },
  { key: "tekstur", label: "Tekstur", hint: "Rangup, lembut, berjus…" },
  { key: "biji", label: "Biji", hint: "Ada / tiada biji." },
  { key: "cara_simpan", label: "Cara simpan", hint: "Praktikal untuk customer." },
  { key: "tempoh_tahan", label: "Tempoh tahan", hint: "Suhu bilik / peti sejuk / beku (anggaran)." },
  { key: "tanda_masak", label: "Tanda masak / cara pilih", hint: "" },
  { key: "cara_makan", label: "Cara makan / hidang", hint: "" },
  { key: "beza_gred", label: "Beza gred / saiz", hint: "Perbezaan antara pilihan saiz/gred kami." },
  { key: "kesihatan", label: "Nota kesihatan", hint: "Umum sahaja (gula, serat). Tiada dakwaan perubatan." },
] as const;
export type FactKey = (typeof FACT_FIELDS)[number]["key"];
export interface FaqItem { q: string; a: string }
export type ProductFacts = Partial<Record<FactKey, string>> & { faq?: FaqItem[] };
export type KnowledgeStatus = "draft" | "verified";
export interface KnowledgeRow {
  product_id: string; facts: ProductFacts; status: KnowledgeStatus; source: string | null;
  drafted_at: string | null; verified_at: string | null; verified_by: string | null; updated_at: string; updated_by: string | null;
}

export const MAX_FIELD = 400;
const clean = (v: unknown, max = MAX_FIELD) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Bersihkan input admin/AI → bentuk ProductFacts yang selamat disimpan. */
export function parseFacts(raw: unknown): ProductFacts {
  const src = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const out: ProductFacts = {};
  for (const f of FACT_FIELDS) { const v = clean(src[f.key]); if (v) out[f.key] = v; }
  const faq = Array.isArray(src.faq) ? src.faq : [];
  const items: FaqItem[] = [];
  for (const it of faq) {
    if (!it || typeof it !== "object") continue;
    const q = clean((it as Record<string, unknown>).q, 200), a = clean((it as Record<string, unknown>).a, MAX_FIELD);
    if (q && a) items.push({ q, a });
    if (items.length >= 8) break;
  }
  if (items.length) out.faq = items;
  return out;
}
export const factsIsEmpty = (f: ProductFacts) => !FACT_FIELDS.some((x) => f[x.key]) && !(f.faq?.length);

/** Fakta disahkan → objek ringkas untuk model (hanya medan berisi). */
export function factsForModel(f: ProductFacts): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const x of FACT_FIELDS) if (f[x.key]) out[x.key] = f[x.key];
  if (f.faq?.length) out.soalan_lazim = f.faq.map((i) => `S: ${i.q} J: ${i.a}`);
  return out;
}

