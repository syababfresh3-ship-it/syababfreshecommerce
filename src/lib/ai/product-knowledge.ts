// ============================================================
// lib/ai/product-knowledge — fakta buah berstruktur (jadual product_knowledge, migration 151)
// + FAQ umum (ai_faq). Fasa 2 docs/plan-ai-chatbot-cerdik.md.
//  • FACT_FIELDS: medan tetap yang admin isi/sahkan.
//  • draftFactsWithAi(): AI jana DRAF dari nama + kategori + saiz + penerangan (status 'draft').
//  • loadVerifiedFacts(): HANYA fakta 'verified' diberi kepada chatbot (get_product_details).
//  • loadActiveFaqText(): FAQ aktif → teks untuk system prompt WA.
// Semua pembaca TOLERAN jadual belum wujud (pulang kosong) supaya chatbot tak pecah sebelum migration.
// ============================================================
import { runAiChat } from "./chat";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export { FACT_FIELDS, MAX_FIELD, parseFacts, factsIsEmpty, factsForModel } from "./product-knowledge-fields";
export type { FactKey, FaqItem, ProductFacts, KnowledgeStatus, KnowledgeRow } from "./product-knowledge-fields";
import { parseFacts, factsIsEmpty, type ProductFacts } from "./product-knowledge-fields";


export async function loadVerifiedFacts(sb: SB, productId: string): Promise<ProductFacts | null> {
  try {
    const { data, error } = await sb.from("product_knowledge").select("facts, status").eq("product_id", productId).eq("status", "verified").maybeSingle();
    if (error || !data) return null;
    const f = parseFacts(data.facts);
    return factsIsEmpty(f) ? null : f;
  } catch { return null; }
}

export async function loadActiveFaqText(sb: SB): Promise<string> {
  try {
    const { data, error } = await sb.from("ai_faq").select("category, question, answer").eq("is_active", true).order("sort_order").order("created_at").limit(80);
    if (error || !data?.length) return "";
    return (data as { category: string | null; question: string; answer: string }[])
      .map((r) => `${r.category ? `[${r.category}] ` : ""}S: ${r.question}\nJ: ${r.answer}`)
      .join("\n");
  } catch { return ""; }
}

// ── Draf AI ────────────────────────────────────────────────────────────────
export interface DraftInput { name: string; category: string | null; unit: string; variants: string[]; description: string }
const DRAFT_SYSTEM = `Anda penulis fakta produk untuk SyababFresh (kedai buah segar & kurma online Malaysia). Tugas: isi kad fakta untuk SATU produk supaya chatbot boleh jawab soalan customer dengan tepat.

PERATURAN:
- Bahasa Melayu ringkas, jelas, mesra-formal. Setiap medan ≤ 220 aksara, satu atau dua ayat.
- UTAMAKAN fakta dari penerangan & nama produk. Untuk cara_simpan, tempoh_tahan, tanda_masak, cara_makan, musim, kesihatan: boleh guna pengetahuan umum tentang JENIS buah ini, tetapi tulis secara konservatif (guna "biasanya", "anggaran").
- asal & biji: isi HANYA jika penerangan/nama menyebutnya atau ia fakta umum pasti untuk varieti itu; kalau tak pasti, biarkan "" (kosong).
- JANGAN sebut harga (sistem ada harga live). JANGAN reka sijil, gred rasmi, dakwaan perubatan, atau fakta yang bercanggah dengan penerangan.
- beza_gred: terangkan perbezaan antara pilihan saiz/gred yang disenaraikan (cth Medium vs Large vs Jumbo) jika relevan; jika tiada gred, "".
- kesihatan: nota umum sahaja (gula semula jadi, serat, vitamin); untuk kurma sebut kandungan gula tinggi — sederhana untuk pesakit kencing manis, rujuk doktor.
- faq: 2–3 soalan yang customer Malaysia biasa tanya tentang produk ini + jawapan ringkas (tanpa harga).
- OUTPUT: JSON sahaja, tanpa markdown, dengan kunci tepat: asal, musim, rasa, tekstur, biji, cara_simpan, tempoh_tahan, tanda_masak, cara_makan, beza_gred, kesihatan, faq (array {q, a}).`;

function extractJson(text: string): unknown {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);   // blok ```json … ``` di mana-mana
  const candidates = [fence?.[1], text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)].filter((c): c is string => !!c && c.trim().length > 1);
  for (const c of candidates) { try { return JSON.parse(c.trim()); } catch { /* cuba seterusnya */ } }
  return null;
}

export async function draftFactsWithAi(p: DraftInput, modelKey = "claude-haiku-5-5"): Promise<{ facts: ProductFacts; modelKey: string; costUsd: number }> {
  const user = `PRODUK: ${p.name}
KATEGORI: ${p.category ?? "-"}
UNIT: ${p.unit}
PILIHAN SAIZ/GRED: ${p.variants.length ? p.variants.join(" | ") : "-"}
PENERANGAN:
${p.description || "(tiada penerangan — guna pengetahuan umum jenis buah ini secara konservatif; biarkan kosong apa yang tak pasti)"}

Keluarkan JSON kad fakta.`;
  const r = await runAiChat({ modelKey, system: DRAFT_SYSTEM, userMessage: user, tools: [], maxTokens: 3000, maxIters: 1 });   // kad penuh BM ≈ 1–1.5k token; jangan terpotong
  const parsed = extractJson(r.text);
  const facts = parseFacts(parsed);
  if (factsIsEmpty(facts)) throw new Error(`AI tidak pulangkan kad fakta yang sah (${r.text.length} aksara${/```/.test(r.text) && !/```\s*$/.test(r.text.trim()) ? ", JSON terpotong" : ""}).`);
  return { facts, modelKey: r.modelKey, costUsd: r.costUsd };
}
