"use client";

// Redesign v2 — Katalog (Zus-style): scroll berterusan melalui seksyen kategori +
// rail jadi jump-nav + scroll-spy (highlight ikut posisi). Produk dalam grid 2-kolum.
//
// Sprint 3B: susun (harga/terbaru) + tapis "Ada stok sahaja" (URL ?sort= & ?stock=1),
// carian token + sinonim BM/EN (lib/search.ts), rail dipacu lajur DB
// categories.show_in_rail / rail_order (migration 125; fallback peraturan lama).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, Megaphone, PackageOpen, ArrowUpDown, PackageCheck, ChevronRight, MessageCircle,
  Flame, Globe, Leaf, Star, Crown, Snowflake, Cherry, GlassWater, Grape, Cookie, Citrus, ShoppingBasket, Apple, ChevronDown,
} from "lucide-react";
import { KATALOG_FAQ } from "@/app/products/faq";
import { humanWaUrl } from "@/lib/support/constants";
import { SORT_OPTIONS, isSoldOut, parseSortKey, searchItems, sortProducts, type SortKey } from "@/lib/search";
import type { ComponentType } from "react";
import { SfProductCard } from "./sf-product-card";
import type { Product, ProductVariant } from "@/types";

interface Cat {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order?: number;
  // Migration 125 — undefined bila lajur belum wujud (fallback peraturan lama di railCfg).
  show_in_rail?: boolean | null;
  rail_order?: number | null;
}
type CatProduct = Product & { category_id: string | null; is_featured: boolean; product_variants?: ProductVariant[] };

type IconCmp = ComponentType<{ className?: string }>;
const CAT_ICON: Record<string, IconCmp> = {
  "buah-import": Globe, "buah-tempatan": Leaf, "bermusim": Star, "durian": Crown, "durian-frozen": Snowflake,
  "delima": Cherry, "jus-minuman": GlassWater, "kismis": Grape, "kacang": Cookie, "ready-to-eat": Cherry,
  "anggur": Grape, "ceri": Cherry, "epal-pear": Apple, "beri-kiwi": Cherry, "sitrus": Citrus,
};
function catIcon(slug: string): IconCmp {
  if (CAT_ICON[slug]) return CAT_ICON[slug];
  if (slug.startsWith("kurma")) return Citrus;
  return ShoppingBasket;
}

const PALING_LAKU = "__paling_laku__";
const LAIN_LAIN = "__lain_lain__";
// Kunci kumpulan Kurma legasi — kekal supaya pautan lama ?category=kurma-all masih jalan.
const KURMA_GROUP = "kurma-all";
const KURMA_PARENT = "kurma";
const isKurma = (c: Cat) => c.slug.startsWith("kurma") || c.name.toLowerCase().startsWith("kurma");
// Fallback SAHAJA (lajur show_in_rail belum wujud): peraturan hardcode sebelum migration 125.
const EXCLUDE_SLUGS = new Set(["makanan-minuman", "buah-kering-kacang"]);
// Kunci sintetik yang tak ditulis ke ?category= (bukan slug sebenar).
const NO_URL_PARAM = new Set([PALING_LAKU, LAIN_LAIN]);

// Papar dalam rail? Dari DB bila lajur ada; jika tidak, tiru kelakuan lama:
// induk makanan/kering disorok, anak kurma-* disorok & digabung ke induk "kurma" di hujung.
function railCfg(c: Cat): { show: boolean; order: number } {
  if (typeof c.show_in_rail === "boolean") return { show: c.show_in_rail, order: c.rail_order ?? 0 };
  if (c.slug === KURMA_PARENT) return { show: true, order: 100 };
  return { show: !EXCLUDE_SLUGS.has(c.slug) && !isKurma(c), order: 0 };
}

// slug = kategori sebenar (untuk pautan "Lihat semua" → /kategori/<slug>); sintetik tiada.
type Section = { key: string; name: string; icon: IconCmp; products: CatProduct[]; slug?: string };

export function SfCatalog({
  categories,
  products,
  initialCategory,
  initialSearch,
  initialSort,
  initialStock,
  announcement,
}: {
  categories: Cat[];
  products: CatProduct[];
  initialCategory?: string;
  initialSearch?: string;
  initialSort?: string;
  initialStock?: boolean;
  announcement?: string;
}) {
  // Fix 1: deep link /products?q=<teks> — seed dari prop, dan selaraskan bila prop
  // berubah (navigasi ke URL lain). Corak "adjust state on prop change" (bukan effect)
  // supaya tiada kelipan nilai lama sebelum nilai baharu.
  const [search, setSearch] = useState(initialSearch ?? "");
  const [prevInitialSearch, setPrevInitialSearch] = useState(initialSearch);
  if (initialSearch !== prevInitialSearch) {
    setPrevInitialSearch(initialSearch);
    setSearch(initialSearch ?? "");
  }

  // Susun & tapis stok — corak yang sama: seed dari ?sort= / ?stock=1, selaras bila prop berubah.
  const [sort, setSort] = useState<SortKey>(parseSortKey(initialSort));
  const [prevInitialSort, setPrevInitialSort] = useState(initialSort);
  if (initialSort !== prevInitialSort) {
    setPrevInitialSort(initialSort);
    setSort(parseSortKey(initialSort));
  }
  const [stockOnly, setStockOnly] = useState(!!initialStock);
  const [prevInitialStock, setPrevInitialStock] = useState(initialStock);
  if (initialStock !== prevInitialStock) {
    setPrevInitialStock(initialStock);
    setStockOnly(!!initialStock);
  }

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Seksyen berterusan: Paling Laku (featured) + satu seksyen setiap kategori rail.
  // Produk kategori tersembunyi digabung ke induknya (kalau induk dipapar); jika tidak
  // → "Kurma" (legasi kurma-* tanpa induk) atau "Lain-lain" — supaya TIADA produk
  // aktif hilang dari katalog bila admin sorok chip.
  const sections = useMemo<Section[]>(() => {
    const cfg = new Map(categories.map((c) => [c.id, railCfg(c)]));
    const shown = (c: Cat) => cfg.get(c.id)?.show === true;
    const bucket = new Map<string, CatProduct[]>();
    const put = (key: string, p: CatProduct) => {
      const arr = bucket.get(key);
      if (arr) arr.push(p); else bucket.set(key, [p]);
    };
    for (const p of products) {
      const c = p.category_id ? byId.get(p.category_id) : undefined;
      const par = c?.parent_id ? byId.get(c.parent_id) : undefined;
      if (c && shown(c)) put(c.slug, p);
      else if (par && shown(par)) put(par.slug, p);
      else if (c && isKurma(c)) put(KURMA_GROUP, p);
      else put(LAIN_LAIN, p);
    }
    // Susunan rail: rail_order → (sort_order induk, induk dulu, sort_order sendiri, nama).
    const railKey = (c: Cat): [number, number, number, number, string] => {
      const par = c.parent_id ? byId.get(c.parent_id) : undefined;
      const base = par ? par.sort_order ?? 999 : c.sort_order ?? 999;
      return [cfg.get(c.id)?.order ?? 0, base, par ? 1 : 0, c.sort_order ?? 0, c.name];
    };
    const rail = categories
      .filter((c) => shown(c) && bucket.has(c.slug))
      .sort((a, b) => {
        const ka = railKey(a), kb = railKey(b);
        for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
        return 0;
      });

    const list: Section[] = [];
    const featured = products.filter((p) => p.is_featured);
    if (featured.length) list.push({ key: PALING_LAKU, name: "Paling Laku", icon: Flame, products: featured });
    for (const c of rail) list.push({ key: c.slug, name: c.name, icon: catIcon(c.slug), products: bucket.get(c.slug)!, slug: c.slug });
    const kurma = bucket.get(KURMA_GROUP);
    if (kurma) list.push({ key: KURMA_GROUP, name: "Kurma", icon: Citrus, products: kurma });
    const lain = bucket.get(LAIN_LAIN);
    if (lain) list.push({ key: LAIN_LAIN, name: "Lain-lain", icon: ShoppingBasket, products: lain });
    return list;
  }, [categories, products, byId]);

  // Tapis stok + susun dalam SETIAP seksyen (habis stok sentiasa di hujung).
  // Seksyen yang kosong selepas tapis disorok (rail ikut sama).
  const viewSections = useMemo(
    () =>
      sections
        .map((s) => ({ ...s, products: sortProducts(stockOnly ? s.products.filter((p) => !isSoldOut(p)) : s.products, sort) }))
        .filter((s) => s.products.length > 0),
    [sections, sort, stockOnly],
  );

  // Carian: nama + kategori + description, token & sinonim (lib/search.ts).
  // "Disyorkan" = ikut relevan; susunan lain mengatasi relevan (habis stok tetap di hujung).
  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const hits = searchItems(products, q, (p) => ({
      name: p.name,
      category: p.category_id ? byId.get(p.category_id)?.name : null,
      description: p.description,
    }));
    return sortProducts(stockOnly ? hits.filter((p) => !isSoldOut(p)) : hits, sort);
  }, [products, search, sort, stockOnly, byId]);

  const totalCount = useMemo(
    () => (stockOnly ? products.filter((p) => !isSoldOut(p)).length : products.length),
    [products, stockOnly],
  );

  // Cadangan bila carian kosong: 4 produk pertama seksyen pertama (Paling Laku), ada stok.
  const popular = useMemo(
    () => (sections[0]?.products ?? products).filter((p) => !isSoldOut(p)).slice(0, 4),
    [sections, products],
  );

  // Scroll-spy
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionEls = useRef<Record<string, HTMLDivElement | null>>({});
  const railEls = useRef<Record<string, HTMLButtonElement | null>>({});
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    if (search.trim()) return;
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) {
          const key = vis[0].target.getAttribute("data-key") || "";
          setActive(key);
          railEls.current[key]?.scrollIntoView({ block: "nearest" });
        }
      },
      { root, rootMargin: "0px 0px -78% 0px", threshold: 0 },
    );
    Object.values(sectionEls.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [viewSections, search]);

  // Fix 1: URL boleh dikongsi — /products?category=<slug>&q=<teks>&sort=<key>&stock=1
  // dikemas kini dengan replaceState (tiada navigasi penuh). Kunci sintetik → tiada param.
  const syncUrl = useCallback((next: { category?: string | null; q?: string; sort?: SortKey; stock?: boolean }) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if ("category" in next) {
      if (next.category && !NO_URL_PARAM.has(next.category)) params.set("category", next.category);
      else params.delete("category");
    }
    if ("q" in next) {
      const q = (next.q ?? "").trim();
      if (q) params.set("q", q); else params.delete("q");
    }
    if ("sort" in next) {
      if (next.sort && next.sort !== "recommended") params.set("sort", next.sort); else params.delete("sort");
    }
    if ("stock" in next) {
      if (next.stock) params.set("stock", "1"); else params.delete("stock");
    }
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, []);

  function jump(key: string) {
    const go = () => sectionEls.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(key);
    syncUrl({ category: key, q: "" });
    if (search.trim()) { setSearch(""); requestAnimationFrame(go); } else { go(); }
  }

  function changeSort(v: string) {
    const k = parseSortKey(v);
    setSort(k);
    syncUrl({ sort: k });
  }

  function toggleStock() {
    const v = !stockOnly;
    setStockOnly(v);
    syncUrl({ stock: v });
  }

  // Slug URL → kunci seksyen: slug sendiri; anak tersembunyi → induknya;
  // kurma-* / kurma-all (legasi) → seksyen "Kurma" (induk sebenar atau kumpulan sintetik).
  const resolveKey = useCallback(
    (slug: string): string | undefined => {
      const has = (k: string) => viewSections.some((s) => s.key === k);
      if (slug === KURMA_GROUP) return has(KURMA_PARENT) ? KURMA_PARENT : has(KURMA_GROUP) ? KURMA_GROUP : undefined;
      if (has(slug)) return slug;
      const cat = categories.find((c) => c.slug === slug);
      const par = cat?.parent_id ? byId.get(cat.parent_id) : undefined;
      if (par && has(par.slug)) return par.slug;
      if (cat && isKurma(cat) && has(KURMA_GROUP)) return KURMA_GROUP;
      return undefined;
    },
    [viewSections, categories, byId],
  );

  // Fix 1: deep link kategori — /products?category=<slug> lompat terus ke seksyen itu
  // selepas mount (dan bila prop berubah). Kalau ada ?q=, mod carian diutamakan
  // (seksyen tersembunyi) — tak perlu lompat. URL TIDAK ditulis semula di sini
  // supaya pautan asal pengguna kekal.
  const jumpedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!initialCategory || jumpedFor.current === initialCategory) return;
    if ((initialSearch ?? "").trim()) return;
    const key = resolveKey(initialCategory);
    if (!key) return;
    jumpedFor.current = initialCategory;
    // Dalam rAF: DOM dah dilukis, dan setState dalam callback (bukan badan effect)
    // tak mencetuskan render bertingkat.
    requestAnimationFrame(() => {
      setActive(key);
      sectionEls.current[key]?.scrollIntoView({ block: "start" });
    });
  }, [initialCategory, initialSearch, resolveKey]);

  // Fix 1: carian → ?q= (debounce ringan supaya tak replaceState setiap ketukan).
  useEffect(() => {
    const t = setTimeout(() => syncUrl({ q: search }), 300);
    return () => clearTimeout(t);
  }, [search, syncUrl]);

  const searching = search.trim().length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* H1 katalog — isyarat topik untuk Google. Ringkas supaya tak makan
          ruang skrin; carian & rail kekal di posisi asal. */}
      <div className="px-4 pt-3 bg-[#F4F6F5]">
        <h1 className="text-[15px] font-extrabold text-gray-900">Katalog Buah Segar Online</h1>
      </div>

      {/* Search */}
      <div className="px-4 pt-2 pb-2 bg-[#F4F6F5]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari buah segar…"
            className="w-full rounded-xl bg-white border border-gray-200 pl-10 pr-3 py-3 text-[14px] font-medium text-gray-900 outline-none focus:border-[#E11D2A]"
          />
        </div>
      </div>

      {/* Susun + tapis — monokrom (aktif = gray-900); keadaan disegerakkan ke URL. */}
      <div className="px-4 pb-2 bg-[#F4F6F5] flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="relative shrink-0">
          <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
            aria-label="Susun ikut"
            className={`h-8 appearance-none rounded-full border bg-white pl-8 pr-7 text-[12px] font-semibold outline-none focus:border-gray-900 ${
              sort !== "recommended" ? "border-gray-900 text-gray-900" : "border-gray-200 text-gray-700"
            }`}
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
        </div>
        <button
          type="button"
          onClick={toggleStock}
          aria-pressed={stockOnly}
          className={`h-8 shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition ${
            stockOnly ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-700"
          }`}
        >
          <PackageCheck className="h-3.5 w-3.5" /> Ada stok sahaja
        </button>
        <span className="ml-auto shrink-0 text-[12px] font-semibold text-gray-400 tabular-nums">{totalCount} produk</span>
      </div>

      {/* Strip pengumuman */}
      {announcement && (
        <div className="mx-4 mb-2 rounded-xl bg-[#FDECEC] px-3 py-2 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-[#E11D2A] shrink-0" />
          <span className="text-[12px] font-semibold text-[#A01018] truncate">{announcement}</span>
        </div>
      )}

      {/* Body: rail + kandungan scroll */}
      <div className="flex-1 flex min-h-0">
        {/* Rail jump-nav */}
        <div className="w-[92px] shrink-0 overflow-y-auto no-scrollbar bg-white border-r border-gray-100">
          {viewSections.map((s) => {
            const on = active === s.key && !searching;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                ref={(el) => { railEls.current[s.key] = el; }}
                onClick={() => jump(s.key)}
                className={`relative w-full flex flex-col items-center gap-1.5 px-1 py-3 text-center ${on ? "bg-[#FDECEC]" : ""}`}
              >
                {on && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r bg-[#E11D2A]" />}
                <Icon className={`h-[19px] w-[19px] ${on ? "text-[#E11D2A]" : "text-gray-400"}`} />
                <span className={`text-[10px] leading-tight ${on ? "text-[#E11D2A] font-bold" : "text-gray-500 font-semibold"}`}>{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Kandungan */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-28 lg:pb-10">
          {searching ? (
            // Mod carian — grid rata
            <>
              <div className="flex items-center justify-between gap-2 pt-3 pb-2">
                <h2 className="text-[15px] font-extrabold text-gray-900">Hasil carian “{search.trim()}”</h2>
                <span className="shrink-0 text-[12px] font-semibold text-gray-400 tabular-nums">{searchResults.length} produk</span>
              </div>
              {searchResults.length === 0 ? (
                <EmptyState query={search.trim()} popular={popular} />
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {searchResults.map((p) => <SfProductCard key={p.id} product={p} />)}
                </div>
              )}
            </>
          ) : viewSections.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-2 py-14">
              <div className="h-12 w-12 rounded-full bg-[#F4F6F5] grid place-items-center">
                <PackageOpen className="h-6 w-6 text-gray-400" />
              </div>
              <div className="text-[13.5px] font-semibold text-gray-500">Tiada produk ada stok buat masa ini</div>
              <button type="button" onClick={toggleStock} className="text-[12px] font-semibold text-gray-900 underline underline-offset-2">
                Papar semua produk
              </button>
            </div>
          ) : (
            // Seksyen berterusan
            viewSections.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  data-key={s.key}
                  ref={(el) => { sectionEls.current[s.key] = el; }}
                  className="scroll-mt-2 pt-4 first:pt-3"
                >
                  <div className="flex items-center gap-1.5 pb-2">
                    <Icon className="h-4 w-4 text-[#E11D2A]" />
                    <h2 className="text-[15px] font-extrabold text-gray-900">{s.name}</h2>
                    <span className="text-[11px] font-semibold text-gray-400">· {s.products.length}</span>
                    {s.slug && (
                      <Link
                        href={`/kategori/${s.slug}`}
                        className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold text-gray-500"
                      >
                        Lihat semua <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {s.products.map((p) => <SfProductCard key={p.id} product={p} />)}
                  </div>
                </div>
              );
            })
          )}

          {/* Soalan lazim — WAJIB kelihatan supaya schema FAQPage di
              products/page.tsx layak dapat rich result. Disembunyikan semasa
              carian aktif supaya tak mengganggu hasil carian. */}
          {!searching && (
            <div className="pt-8 pb-4">
              <h2 className="text-[15px] font-extrabold text-gray-900 mb-3">Soalan lazim</h2>
              <div className="space-y-2">
                {KATALOG_FAQ.map((f) => (
                  <details key={f.q} className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                    <summary className="text-[13px] font-bold text-gray-900 cursor-pointer list-none flex items-center justify-between gap-2">
                      {f.q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                    </summary>
                    <p className="text-[13px] text-gray-500 leading-relaxed mt-2">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Carian kosong: ajak tanya WhatsApp (CS manusia) + 4 produk popular supaya
// pelanggan tak buntu di skrin kosong.
function EmptyState({ query, popular }: { query: string; popular: CatProduct[] }) {
  const wa = humanWaUrl(`Hai SyababFresh, saya cari "${query}" tapi tak jumpa dalam katalog. Ada tak?`);
  return (
    <div>
      <div className="flex flex-col items-center text-center gap-2 py-8">
        <div className="h-12 w-12 rounded-full bg-[#F4F6F5] grid place-items-center">
          <PackageOpen className="h-6 w-6 text-gray-400" />
        </div>
        <div className="text-[13.5px] font-semibold text-gray-500">Tiada produk dijumpai</div>
        <div className="text-[12px] text-gray-400">Cuba kata kunci lain, atau tanya kami terus.</div>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gray-900 text-white text-[12px] font-bold px-4 py-2 active:scale-95 transition"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Hubungi kami di WhatsApp
        </a>
      </div>
      {popular.length > 0 && (
        <>
          <h3 className="text-[13px] font-extrabold text-gray-900 pb-2">Popular</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {popular.map((p) => <SfProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
