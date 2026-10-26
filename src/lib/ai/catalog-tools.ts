// ============================================================
// lib/ai/catalog-tools — pengetahuan produk untuk AI (chatbot WA + /support).
// Fasa 1 "cerdikkan chatbot" (docs/plan-ai-chatbot-cerdik.md):
//  • search_products: cari nama + kategori + penerangan, faham sinonim BM/EN
//    (ceri=cherry, delima=pomegranate, kurma=ajwa/mariami/…), skor padanan, ≤8 hasil.
//  • get_product_details: kad produk PENUH — penerangan penuh, semua saiz + harga,
//    promo (compare_price), berat, status stok (ada/sedikit/habis — TANPA angka), pautan.
// Katalog (≤100 produk aktif) dimuat sekali & dicache 3 minit dalam memori fungsi.
// Read-only. Dikongsi oleh wa-tools.ts (neutral) dan support/tools.ts (Anthropic).
// ============================================================
import type { AiToolDef } from "./tools";
import { SHOP_ORIGIN } from "@/lib/kurma-host";
import { factsForModel, loadVerifiedFacts } from "./product-knowledge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface Variant { name: string; price: number; compare_price: number | null; stock: number | null; sort_order: number }
interface CatalogProduct {
  id: string; name: string; slug: string; unit: string; price: number; compare_price: number | null;
  description: string; is_cold: boolean; is_featured: boolean; sort_order: number; category: string | null; variants: Variant[];
}

// ── Sinonim BM/EN & nama varieti → kumpulan. Satu token padan mana-mana ahli → semua ahli dicari.
const SYNONYMS: string[][] = [
  ["ceri", "cherry", "cherries"],
  ["delima", "pomegranate"],
  ["anggur", "grape", "grapes", "muscat", "shine muscat", "sweet globe", "crimson", "autumn royal", "midnight beauty"],
  ["kurma", "dates", "tamar", "ajwa", "mariami", "safawi", "medjoul", "medjool", "sukkari", "rotab", "mabroom", "libya", "tunisia", "tangkai"],
  ["limau", "oren", "orange", "mandarin", "citrus", "sitrus", "navel", "valencia", "pomelo", "thaptim", "limau bali"],
  ["lemon"],
  ["pic", "peach", "persik"],
  ["epal", "apple", "fuji"],
  ["pear", "pir", "forella", "singo"],
  ["mangga", "mango", "harumanis", "harum manis"],
  ["strawberi", "strawberry", "strawberries"],
  ["blueberi", "blueberry", "blueberries", "beri", "berry", "berries"],
  ["kiwi", "zespri"],
  ["kismis", "raisin", "raisins", "sultana"],
  ["kacang", "nut", "nuts", "almond", "badam", "cashew", "gajus", "pistachio", "pistasio"],
  ["aprikot", "apricot"],
  ["tin", "fig", "figs", "buah tin"],
  ["tembikai", "watermelon", "melon", "hami"],
  ["nanas", "pineapple", "md2"],
  ["jambu", "guava", "lohan"],
  ["naga", "dragon fruit", "dragonfruit", "pitaya", "buah naga"],
  ["avokado", "avocado", "hass"],
  ["persimmon", "kesemek", "buah kaki"],
  ["jus", "juice", "minuman", "botol"],
  ["serunding", "floss"],
  ["potong", "fresh-cut", "fresh cut", "cubits", "ready to eat", "siap potong", "siap makan"],
  ["gula-gula", "candy"],
  ["beku", "frozen", "sejuk beku"],
  ["kotak", "gift", "hadiah", "premium"],
];
// Kata yang tak membantu carian (soalan harga/kuantiti) — dibuang dari query.
const STOP = new Set(["harga", "berapa", "brp", "ada", "tak", "ke", "nak", "beli", "saya", "untuk", "yang", "dan", "rm", "kg", "sekilo", "berat", "sebiji", "biji", "pek", "pack", "stok", "stock", "habis", "lagi", "ni", "tu", "the", "price", "how", "much", "is", "are", "there", "any", "buah", "fruit", "fresh", "segar", "jual", "sell", "dari", "mana", "apa", "boleh", "x", "tidak", "dah", "sudah", "promo", "promosi", "murah", "sedap", "manis"]);

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
const tokens = (q: string) => norm(q).split(" ").filter((t) => t.length >= 2 && !STOP.has(t));
// Token asal customer (berat penuh) vs sinonim yang dikembangkan (berat separuh) — supaya "kurma ajwa"
// utamakan Ajwa, bukan semua kurma.
function expand(q: string): { direct: string[]; related: string[] } {
  const direct = new Set<string>(tokens(q));
  const related = new Set<string>();
  for (const t of direct) {
    for (const group of SYNONYMS) if (group.some((g) => g === t || t.startsWith(g) || (g.startsWith(t) && t.length >= 4))) group.forEach((g) => { if (!direct.has(g)) related.add(g); });
  }
  return { direct: [...direct], related: [...related] };
}

// ── Katalog + cache ────────────────────────────────────────────────────────
let cache: { at: number; items: CatalogProduct[] } | null = null;
const TTL = 3 * 60_000;
async function loadCatalog(sb: SB): Promise<CatalogProduct[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.items;
  const { data, error } = await sb
    .from("products")
    .select("id, name, slug, unit, price, compare_price, description, is_cold, is_featured, sort_order, show_in_storefront, categories(name), product_variants(name, price, compare_price, stock, is_active, sort_order, deleted_at)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  const items: CatalogProduct[] = (data ?? [])
    .filter((p: { show_in_storefront?: boolean | null }) => p.show_in_storefront !== false)   // produk LP/Live sahaja disorok
    .map((p: Record<string, unknown>) => ({
      id: String(p.id), name: String(p.name ?? "").trim(), slug: String(p.slug ?? ""), unit: String(p.unit ?? ""),
      price: Number(p.price) || 0, compare_price: p.compare_price != null ? Number(p.compare_price) : null,
      description: String(p.description ?? "").trim(), is_cold: p.is_cold !== false, is_featured: !!p.is_featured, sort_order: Number(p.sort_order) || 0,
      category: (p.categories as { name?: string } | null)?.name ?? null,
      variants: ((p.product_variants as Record<string, unknown>[] | null) ?? [])
        .filter((v) => v.is_active !== false && !v.deleted_at)
        .map((v) => ({ name: String(v.name ?? "").trim(), price: Number(v.price) || 0, compare_price: v.compare_price != null ? Number(v.compare_price) : null, stock: v.stock == null ? null : Number(v.stock), sort_order: Number(v.sort_order) || 0 }))
        .sort((a, b) => a.sort_order - b.sort_order || a.price - b.price),
    }));
  cache = { at: Date.now(), items };
  return items;
}

// ── Stok: ikut semantik kedai (null = tiada had, 0 = habis, 1–5 = sedikit). TANPA angka untuk customer.
type StockStatus = "ada" | "sedikit" | "habis";
const variantStock = (v: Variant): StockStatus => (v.stock === 0 ? "habis" : v.stock !== null && v.stock <= 5 ? "sedikit" : "ada");
function productStock(p: CatalogProduct): string {
  if (!p.variants.length) return "sahkan dengan team (tiada saiz aktif)";
  const st = p.variants.map(variantStock);
  if (st.every((s) => s === "habis")) return "habis";
  if (st.some((s) => s === "habis")) return "sebahagian saiz habis";
  if (st.some((s) => s === "sedikit")) return "sedikit";
  return "ada";
}
const rm = (n: number) => `RM${n.toFixed(2)}`;
const promo = (price: number, compare: number | null) => (compare && compare > price ? ` (harga asal ${rm(compare)})` : "");
const sizeLine = (v: Variant) => `${v.name} ${rm(v.price)}${promo(v.price, v.compare_price)}${variantStock(v) === "ada" ? "" : ` [${variantStock(v)}]`}`;
const productUrl = (p: CatalogProduct) => `${SHOP_ORIGIN}/products/${p.slug}`;

// ── Skor padanan ───────────────────────────────────────────────────────────
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function score(p: CatalogProduct, terms: { direct: string[]; related: string[] }, whole: string): number {
  const name = norm(p.name), cat = norm(p.category ?? ""), desc = norm(p.description);
  let s = 0;
  if (whole && name.includes(whole)) s += 15;
  const hit = (t: string, w: number) => {
    if (name.includes(t)) s += new RegExp(`(^|\\s)${esc(t)}(\\s|$)`).test(name) ? 12 * w : 8 * w;
    if (cat.includes(t)) s += 6 * w;
    if (desc.includes(t)) s += 2 * w;
  };
  for (const t of terms.direct) hit(t, 1);
  for (const t of terms.related) hit(t, 0.4);
  if (s > 0 && p.is_featured) s += 1;          // pemutus seri: produk popular
  if (s > 0 && !p.variants.length) s -= 3;     // senarai tanpa saiz aktif (biasanya pendua/rosak) tenggelam
  return s;
}
function rank(items: CatalogProduct[], query: string): CatalogProduct[] {
  const q = norm(query);
  if (!q || !tokens(query).length) return items.filter((p) => p.is_featured && p.variants.length).slice(0, 8);
  const terms = expand(query);
  const scored = items.map((p) => ({ p, s: score(p, terms, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.p.sort_order - b.p.sort_order);
  const top = scored[0]?.s ?? 0;
  return scored.filter((x) => x.s >= Math.max(3, top * 0.3)).map((x) => x.p);   // buang padanan lemah (cth warna "oren" dalam penerangan)
}

// ── Hasil untuk model ──────────────────────────────────────────────────────
export async function searchProducts(sb: SB, query: string): Promise<string> {
  const items = await loadCatalog(sb);
  const hits = rank(items, query).slice(0, 8);
  if (!hits.length) return `Tiada produk padan "${query}". Beritahu customer kami tiada buat masa ini, cadang yang hampir (cuba search_products dengan kata lain), dan tawar maklum bila ada.`;
  return JSON.stringify({
    nota: "Harga ikut saiz. Status stok: ada / sedikit / habis — JANGAN sebut angka. Panggil get_product_details(nama) untuk penerangan penuh sebelum jawab soalan rasa/asal/simpan.",
    produk: hits.map((p) => ({
      nama: p.name,
      kategori: p.category,
      stok: productStock(p),
      saiz_harga: p.variants.length ? p.variants.map(sizeLine) : [`${rm(p.price)}/${p.unit}${promo(p.price, p.compare_price)}`],
      ringkas: p.description.replace(/\s+/g, " ").slice(0, 120),
    })),
  });
}

export async function getProductDetails(sb: SB, nameOrQuery: string): Promise<string> {
  const items = await loadCatalog(sb);
  const q = norm(nameOrQuery);
  const exact = items.find((p) => norm(p.name) === q);
  const best = exact ?? rank(items, nameOrQuery)[0];
  if (!best) return `Tiada produk padan "${nameOrQuery}". Cuba search_products dengan kata kunci lain.`;
  const others = rank(items, nameOrQuery).filter((p) => p.id !== best.id).slice(0, 3).map((p) => p.name);
  const facts = await loadVerifiedFacts(sb, best.id);   // Fasa 2: hanya fakta DISAHKAN admin (migration 151)
  return JSON.stringify({
    nama: best.name,
    kategori: best.category,
    penerangan: best.description || "(tiada penerangan — jawab hanya fakta dari saiz/harga; akui kalau tak pasti)",
    ...(facts ? { fakta_disahkan: factsForModel(facts) } : { fakta_tambahan: "tiada fakta disahkan untuk produk ini — jawab hanya dari penerangan di atas; akui jujur kalau tak pasti (cth tempoh tahan, musim)" }),
    unit_asas: `${rm(best.price)}/${best.unit}${promo(best.price, best.compare_price)}`,
    saiz: best.variants.map((v) => ({ saiz: v.name, harga: rm(v.price), ...(v.compare_price && v.compare_price > v.price ? { harga_asal: rm(v.compare_price), promo: true } : {}), stok: variantStock(v) })),   // berat_g sengaja tiada: weight_grams banyak placeholder 100g
    stok_keseluruhan: productStock(best),
    penghantaran: best.is_cold ? "Perlu kurier sejuk: Klang Valley hari sama/24 jam; luar KV Ninja Van Cold 1–3 hari bekerja." : "Boleh pos biasa (bukan rantaian sejuk).",
    pautan: productUrl(best),
    bila_habis: "Customer boleh daftar 'Kami WhatsApp anda bila stok masuk' di pautan produk, atau tawar saiz/produk lain yang ada.",
    ...(others.length ? { produk_berkaitan: others } : {}),
  });
}

// ── Takrifan tool (neutral) + runner kongsi ────────────────────────────────
export const CATALOG_TOOLS: AiToolDef[] = [
  {
    name: "search_products",
    description:
      "Cari produk SyababFresh yang aktif. Faham BM & EN serta sinonim (ceri=cherry, delima=pomegranate, anggur=grape/muscat, kurma=ajwa/mariami/safawi/medjoul/sukkari, limau=orange/mandarin). Cari dalam nama, kategori & penerangan. Pulang ≤8 padanan: nama, kategori, status stok (ada/sedikit/habis), harga setiap saiz (+promo), ringkasan. Kosongkan query untuk produk popular. Untuk soalan rasa/asal/cara simpan/ada biji, sambung dengan get_product_details.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: 'Kata kunci, cth "ceri", "shine muscat", "kurma ajwa", "buah potong". Kosong = popular.' } },
      required: [],
    },
  },
  {
    name: "get_product_details",
    description:
      "Kad produk PENUH untuk SATU produk: penerangan penuh (asal, rasa, tekstur, cara makan), semua saiz dengan harga, promo, berat & status stok, penghantaran (kurier sejuk), pautan produk, dan apa nak buat bila habis. WAJIB guna sebelum jawab soalan tentang buah tertentu — jawab hanya dari data ini, jangan reka.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Nama produk seperti dalam hasil search_products (atau kata kunci paling hampir)." } },
      required: ["name"],
    },
  },
];

/** Pulang null kalau bukan tool katalog (pemanggil sambung ke tool lain). */
export async function runCatalogTool(sb: SB, name: string, input: Record<string, unknown>): Promise<string | null> {
  if (name === "search_products") return searchProducts(sb, String(input.query ?? ""));
  if (name === "get_product_details") return getProductDetails(sb, String(input.name ?? input.query ?? ""));
  return null;
}

// ── Peraturan jawab soalan buah (ditambah ke system prompt WA & /support; statik → boleh cache) ──
export const FRUIT_QA_RULES = `CARA JAWAB SOALAN BUAH (penting):
- Setiap soalan tentang produk/buah (rasa, asal, saiz, berat, stok, harga, cara simpan, ada biji, sesuai untuk siapa): panggil search_products dahulu, kemudian get_product_details untuk produk yang dimaksudkan, dan jawab BERDASARKAN penerangan & data itu. Jangan jawab dari ingatan umum kalau produk itu ada dalam katalog.
- Stok: guna status dari tool — "ada", "sedikit" (tinggal sikit, galak cepat), "habis". Kalau habis: beritahu jujur, tawar saiz/produk lain yang ada, dan beritahu boleh daftar "Kami WhatsApp anda bila stok masuk" di pautan produk. JANGAN sebut angka stok.
- Utamakan "fakta_disahkan" (disemak team) bila ada; kemudian penerangan. Kalau fakta yang ditanya TIADA dalam kedua-duanya (cth musim tepat, tempoh tahan, bilangan biji): jawab apa yang ada, akui jujur bahagian yang tak pasti, dan tawar semak dengan team. JANGAN reka negara asal, gred, khasiat, tarikh atau harga.
- Soalan kesihatan (diabetes, mengandung, bayi, alahan): maklumat umum sahaja (cth kurma manis semula jadi, kandungan gula tinggi), tiada dakwaan perubatan; nasihat rujuk doktor untuk keadaan khusus.
- Perbandingan (cth Ajwa Medium vs Large, Harumanis Surabaya vs Perlis): bandingkan hanya ikut penerangan produk kami; untuk produk yang kami tak jual, kata kami tak jual dan tak boleh sahkan.
- Produk perlu kurier sejuk: luar Klang Valley guna Ninja Van Cold (1–3 hari bekerja); jangan janji hari sama luar KV.
- Nama buah yang tiada dalam katalog (search kosong): beritahu kami tiada buat masa ini, cadang yang hampir, dan tawar maklum bila ada.
- Jawab ringkas: sebut 1–2 saiz paling relevan dengan keperluan customer, tawar tunjuk saiz lain kalau mereka nak.`;
