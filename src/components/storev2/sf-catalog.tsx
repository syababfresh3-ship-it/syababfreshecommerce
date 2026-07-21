"use client";

// Redesign v2 — Katalog (Zus-style): scroll berterusan melalui seksyen kategori +
// rail jadi jump-nav + scroll-spy (highlight ikut posisi). Produk dalam grid 2-kolum.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Megaphone, PackageOpen,
  Flame, Globe, Leaf, Star, Crown, Snowflake, Cherry, GlassWater, Grape, Cookie, Citrus, ShoppingBasket, Apple,
} from "lucide-react";
import type { ComponentType } from "react";
import { SfProductCard } from "./sf-product-card";
import type { Product, ProductVariant } from "@/types";

interface Cat {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order?: number;
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
const KURMA_GROUP = "kurma-all";
const isKurma = (c: Cat) => c.slug.startsWith("kurma") || c.name.toLowerCase().startsWith("kurma");
const EXCLUDE_SLUGS = new Set(["makanan-minuman", "buah-kering-kacang"]);

type Section = { key: string; name: string; icon: IconCmp; products: CatProduct[] };

export function SfCatalog({
  categories,
  products,
  announcement,
}: {
  categories: Cat[];
  products: CatProduct[];
  initialCategory?: string;
  initialSearch?: string;
  announcement?: string;
}) {
  const [search, setSearch] = useState("");

  // Rail order (induk → anak, ikut sort_order) + Kurma di hujung.
  const { cats, kurmaIds } = useMemo(() => {
    const used = new Set(products.map((p) => p.category_id));
    const kIds = new Set(categories.filter(isKurma).map((c) => c.id));
    const byId = new Map(categories.map((c) => [c.id, c]));
    const childByParent = (id: string) => categories.some((c) => c.parent_id === id && used.has(c.id));
    const railKey = (c: Cat): [number, number, number, string] => {
      const par = c.parent_id ? byId.get(c.parent_id) : null;
      const base = par ? par.sort_order ?? 999 : c.sort_order ?? 999;
      return [base, par ? 1 : 0, c.sort_order ?? 0, c.name];
    };
    const nonKurma = categories
      .filter((c) => !isKurma(c) && !EXCLUDE_SLUGS.has(c.slug) && (used.has(c.id) || childByParent(c.id)))
      .sort((a, b) => {
        const ka = railKey(a), kb = railKey(b);
        for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
        return 0;
      });
    const hasKurma = products.some((p) => kIds.has(p.category_id ?? ""));
    const rail: Cat[] = [...nonKurma];
    if (hasKurma) rail.push({ id: KURMA_GROUP, slug: KURMA_GROUP, name: "Kurma", parent_id: null });
    return { cats: rail, kurmaIds: kIds };
  }, [categories, products]);

  // Seksyen berterusan: Paling Laku (featured) + setiap kategori (produk LANGSUNG, elak ulang).
  const sections = useMemo<Section[]>(() => {
    const list: Section[] = [];
    const featured = products.filter((p) => p.is_featured);
    if (featured.length) list.push({ key: PALING_LAKU, name: "Paling Laku", icon: Flame, products: featured });
    for (const c of cats) {
      const prods = c.slug === KURMA_GROUP
        ? products.filter((p) => kurmaIds.has(p.category_id ?? ""))
        : products.filter((p) => p.category_id === c.id);
      if (prods.length) list.push({ key: c.slug, name: c.name, icon: catIcon(c.slug), products: prods });
    }
    return list;
  }, [cats, products, kurmaIds]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : [];
  }, [products, search]);

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
  }, [sections, search]);

  function jump(key: string) {
    const go = () => sectionEls.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(key);
    if (search.trim()) { setSearch(""); requestAnimationFrame(go); } else { go(); }
  }

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
          {sections.map((s) => {
            const on = active === s.key && !search.trim();
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
          {search.trim() ? (
            // Mod carian — grid rata
            <>
              <div className="flex items-center justify-between pt-3 pb-2">
                <h2 className="text-[15px] font-extrabold text-gray-900">Hasil carian “{search.trim()}”</h2>
                <span className="text-[12px] font-semibold text-gray-400">{searchResults.length}</span>
              </div>
              {searchResults.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {searchResults.map((p) => <SfProductCard key={p.id} product={p} />)}
                </div>
              )}
            </>
          ) : (
            // Seksyen berterusan
            sections.map((s) => {
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
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {s.products.map((p) => <SfProductCard key={p.id} product={p} />)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-14">
      <div className="h-12 w-12 rounded-full bg-[#F4F6F5] grid place-items-center">
        <PackageOpen className="h-6 w-6 text-gray-400" />
      </div>
      <div className="text-[13.5px] font-semibold text-gray-500">Tiada produk dijumpai</div>
      <div className="text-[12px] text-gray-400">Cuba kata kunci lain.</div>
    </div>
  );
}
