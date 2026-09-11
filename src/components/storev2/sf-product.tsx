"use client";

// Redesign v2 — Produk detail (pushed screen): galeri + pemilih variant + benefit + sticky add.
// Seksyen I: nama bersih (buang saiz), label dinamik (Saiz/Pakej), harga per-unit + jimat,
// kuantiti berasingan dari variant, penunjuk stok.
// Sprint 3C: galeri swipe (image_url + product_images), "{n} terjual dalam 30 hari"
// (nombor sebenar, >= 5 sahaja), anggaran penghantaran ikut poskod, bar melekat
// bertukar ke "Lihat Troli" selepas tambah, "Anda mungkin suka" = selalu dibeli bersama.
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Heart, Star, Leaf, Truck, RotateCcw, Plus, Minus, Check, TrendingUp, ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/lib/stores/cart";
import { ProductReviews } from "@/app/products/[slug]/reviews";
import { SfWaitlist } from "@/components/storev2/sf-waitlist";
import { SfProductGallery, type GalleryImage } from "@/components/storev2/sf-product-gallery";
import { SfDeliveryEstimate } from "@/components/storev2/sf-delivery-estimate";
import { ARTIKEL } from "@/app/panduan/artikel";
import type { Product, ProductVariant } from "@/types";

// Pautan kluster: padan produk (nama + kategori) → artikel panduan berkaitan.
// Kuatkan pautan dalaman dari 94 page produk ke artikel & pillar /buah-online.
// Guna tajuk sebenar dari ARTIKEL supaya tak mati bila artikel berubah.
const GUIDE_MAP: { re: RegExp; slugs: string[] }[] = [
  { re: /ceri|cherry/i, slugs: ["cara-simpan-ceri", "panduan-ceri-turki"] },
  { re: /kurma|ajwa|safawi|mariami|medjo?ul|sukkari/i, slugs: ["jenis-kurma-malaysia", "panduan-kurma-ajwa"] },
  { re: /anggur|grape|muscat/i, slugs: ["panduan-anggur-import"] },
  { re: /harumanis|mangga|mango/i, slugs: ["panduan-harumanis"] },
];
function relatedGuides(name: string, catName?: string): { slug: string; title: string }[] {
  const hay = `${name} ${catName ?? ""}`;
  let slugs = GUIDE_MAP.find((g) => g.re.test(hay))?.slugs ?? ["cara-simpan-buah-peti-sejuk"];
  slugs = slugs.slice(0, 2);
  return slugs
    .map((s) => ARTIKEL.find((a) => a.slug === s))
    .filter((a): a is (typeof ARTIKEL)[number] => !!a)
    .map((a) => ({ slug: a.slug, title: a.title }));
}

type DetailProduct = Product & {
  categories?: { name: string; slug: string } | null;
  product_variants?: ProductVariant[];
};

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: { full_name: string | null };
}

type RelatedProduct = Pick<Product, "id" | "name" | "slug" | "price" | "unit" | "image_url">;

// Hurai nama variant → kiraan bundle + unit + sama ada ia berat.
function parseVariant(name: string): { count: number; unit: string; weight: boolean } {
  const m = name.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z/]+)/);
  if (!m) return { count: 1, unit: name.trim(), weight: false };
  const num = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const weight = /^(g|gram|kg|kgm|kilo|kilogram|ml|l|liter|litre)/.test(unit);
  return { count: weight ? 1 : num, unit, weight };
}

export function SfProduct({
  product,
  reviews = [],
  canReview = false,
  related = [],
  productStock = null,
  images,
  unitsSold30d = 0,
}: {
  product: DetailProduct;
  reviews?: ReviewRow[];
  canReview?: boolean;
  related?: RelatedProduct[];
  productStock?: number | null; // stok produk TANPA variant (view product_stock); null = tak dijejak
  images?: GalleryImage[]; // galeri (image_url dahulu); tiada → guna image_url sahaja
  unitsSold30d?: number; // unit terjual 30 hari (bukti sosial; papar bila >= 5)
}) {
  const variants = (product.product_variants ?? [])
    .filter((v) => v.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const hasVariants = variants.length > 0;

  const [variant, setVariant] = useState<ProductVariant | null>(hasVariants ? variants[0] : null);
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  // Bar melekat: selepas tambah → "Lihat Troli · RM{jumlah troli}" (kembali bila variant/kuantiti diubah)
  const [added, setAdded] = useState(false);
  const cartItems = useCartStore((s) => s.items);
  const cartTotal = cartItems.reduce((t, it) => t + Number(it.variant?.price ?? it.product.price) * it.quantity, 0);
  const cartCount = cartItems.reduce((n, it) => n + it.quantity, 0);
  const pickVariant = (v: ProductVariant) => { setVariant(v); setAdded(false); };
  const changeQty = (fn: (q: number) => number) => { setQty(fn); setAdded(false); };

  // Wishlist SEBENAR (table wishlists) — sebelum ni useState lokal je, hilang bila refresh.
  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.auth.getUser() as Promise<any>).then((res) => {
      const user = res.data?.user;
      if (!user) return;
      supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .maybeSingle()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) => setLiked(!!r.data));
    });
  }, [product.id]);

  async function toggleWishlist() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sila log masuk untuk simpan produk");
      return;
    }
    if (liked) {
      setLiked(false);
      await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", product.id);
      toast.success("Dibuang dari senarai suka");
    } else {
      setLiked(true);
      await supabase.from("wishlists").insert({ user_id: user.id, product_id: product.id });
      toast.success("Disimpan ke senarai suka!");
    }
  }

  // #1 Buang saiz/berat dalam kurungan dari nama (paparan sahaja): "Sweet Lychee (500Gram)" → "Sweet Lychee".
  const cleanName = product.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || product.name;

  // #2 Label dinamik: variant berat → "Pilih Saiz"; bundle (pack/botol) → "Pilih Pakej".
  const allWeight = hasVariants && variants.every((v) => parseVariant(v.name).weight);
  const pickerLabel = allWeight ? "Pilih Saiz" : "Pilih Pakej";

  const unitPrice = variant?.price ?? product.price;
  const total = unitPrice * qty;
  const catName = product.categories?.name;

  // #5 Penunjuk stok — variant terpilih; produk tanpa variant guna product_stock
  // (batch). null/undefined = stok tak dijejak → anggap ada (perangai lama).
  const stock = hasVariants ? variant?.stock : (productStock ?? undefined);
  const soldOut = stock !== undefined && stock <= 0;
  const lowStock = stock !== undefined && stock > 0 && stock <= 10;

  const about =
    product.description?.trim() ||
    `${cleanName} segar pilihan SyababFresh — disimpan sejuk dan dihantar terus untuk kekalkan kesegaran. Sesuai dimakan terus atau jadi hidangan keluarga.`;

  function add() {
    if (soldOut) return;
    addItem(product, qty, variant);
    setAdded(true);
    toast.success(`${qty}× ${cleanName}${variant ? ` (${variant.name})` : ""} ditambah ke troli`);
  }

  const galleryImages: GalleryImage[] =
    images ?? (product.image_url ? [{ url: product.image_url, alt: null }] : []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur px-3 h-[52px] flex items-center">
        <Link href="/products" className="h-10 w-10 grid place-items-center -ml-1" aria-label="Kembali">
          <ChevronLeft className="h-6 w-6 text-gray-900" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Hero — galeri swipe, kotak seragam (object-cover, semua produk sama bentuk) */}
        <SfProductGallery images={galleryImages} name={cleanName}>
          {catName && (
            <span className="absolute top-3 left-3 bg-gray-900 text-white text-[10px] font-bold rounded-full px-2.5 py-1">{catName}</span>
          )}
          <button
            onClick={toggleWishlist}
            className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-white shadow"
            aria-label="Senarai suka"
          >
            <Heart className={`h-5 w-5 ${liked ? "fill-[#E11D2A] text-[#E11D2A]" : "text-gray-400"}`} />
          </button>
        </SfProductGallery>

        {/* Info */}
        <div className="px-4 pt-4 max-w-2xl mx-auto">
          {catName && <div className="text-[11px] font-bold text-[#E11D2A] uppercase tracking-wide">{catName}</div>}
          <h1 className="text-[22px] font-extrabold text-gray-900 mt-0.5 leading-tight">{cleanName}</h1>
          {/* Rating SEBENAR dari ulasan customer — tiada ulasan = tak tunjuk nombor palsu */}
          {reviews.length > 0 ? (
            <div className="flex items-center gap-1.5 mt-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="text-[13px] font-bold text-gray-900">
                {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
              </span>
              <span className="text-[12px] text-gray-400">({reviews.length} ulasan)</span>
            </div>
          ) : null}
          {/* Bukti sosial — unit terjual SEBENAR 30 hari; < 5 → tak tunjuk (tiada nombor palsu) */}
          {unitsSold30d >= 5 && (
            <div className="flex items-center gap-1.5 mt-1 text-[12px] font-semibold text-gray-600" data-testid="units-sold">
              <TrendingUp className="h-3.5 w-3.5 text-gray-700" aria-hidden />
              <span>{unitsSold30d} terjual dalam 30 hari</span>
            </div>
          )}
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-[26px] font-extrabold text-[#E11D2A]">RM{Number(unitPrice).toFixed(2)}</span>
            {variant && <span className="text-[13px] text-gray-400 font-medium">/{variant.name}</span>}
            {!variant && <span className="text-[13px] text-gray-400 font-medium">/{product.unit}</span>}
            {variant?.compare_price && variant.compare_price > unitPrice && (
              <span className="text-[13px] text-gray-400 line-through">RM{Number(variant.compare_price).toFixed(2)}</span>
            )}
          </div>

          {/* #5 Stok + #4 jimat (variant terpilih) */}
          <div className="flex items-center gap-2 mt-1.5">
            {soldOut ? (
              <span className="text-[11.5px] font-bold text-red-500">Habis stok</span>
            ) : lowStock ? (
              <span className="text-[11.5px] font-bold text-amber-600">Stok terhad · tinggal {stock}</span>
            ) : stock !== undefined ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Ada stok
              </span>
            ) : null}
            {variant?.compare_price && variant.compare_price > unitPrice && (
              <span className="text-[10px] font-extrabold bg-[#FDECEC] text-[#E11D2A] rounded-full px-2 py-0.5">
                Jimat RM{(variant.compare_price - unitPrice).toFixed(0)}
              </span>
            )}
          </div>

          {/* Waitlist — HANYA muncul bila habis stok (tiada kesan pada flow biasa) */}
          {soldOut && <SfWaitlist productId={product.id} />}

          {/* #1/#2/#4 Pemilih variant */}
          {hasVariants && (
            <div className="mt-4">
              <div className="text-[13px] font-bold text-gray-900 mb-2">{pickerLabel}</div>
              <div className="grid grid-cols-3 gap-2">
                {variants.map((v) => {
                  const on = variant?.id === v.id;
                  const { count, unit, weight } = parseVariant(v.name);
                  const perUnit = !weight && count > 1 ? v.price / count : null;
                  const vSoldOut = v.stock !== undefined && v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      onClick={() => pickVariant(v)}
                      disabled={vSoldOut}
                      className={`rounded-xl border p-2.5 text-center transition ${
                        on ? "border-[#E11D2A] bg-[#FDECEC]" : "border-gray-200"
                      } ${vSoldOut ? "opacity-40" : ""}`}
                    >
                      <div className={`text-[13px] font-bold ${on ? "text-[#E11D2A]" : "text-gray-900"}`}>{v.name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">RM{Number(v.price).toFixed(2)}</div>
                      {/* #4 harga per-unit untuk bundle → tonjol jimat pukal */}
                      {perUnit && (
                        <div className="text-[9.5px] text-gray-400 mt-0.5">RM{perUnit.toFixed(2)}/{unit}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* #3 Kuantiti — berasingan & jelas dari pemilih pakej di atas */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-[13px] font-bold text-gray-900">Kuantiti</div>
            <div className="flex items-center gap-2 bg-[#F4F6F5] rounded-full p-1">
              <button onClick={() => changeQty((q) => Math.max(1, q - 1))} className="h-8 w-8 grid place-items-center rounded-full bg-white text-gray-900" aria-label="Kurang">
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-[15px] font-extrabold text-gray-900 w-6 text-center">{qty}</span>
              <button onClick={() => changeQty((q) => q + 1)} className="h-8 w-8 grid place-items-center rounded-full bg-white text-gray-900" aria-label="Tambah">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Anggaran penghantaran ikut poskod (nasihat; disahkan semula di Checkout) */}
          <SfDeliveryEstimate subtotal={total} shippable={product.is_shippable !== false} productName={cleanName} />

          {/* Benefit chips */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { i: Leaf, t: "100% Segar" },
              { i: Truck, t: "Hantar Pantas" },
              { i: RotateCcw, t: "Ganti / Refund" },
            ].map(({ i: Icon, t }) => (
              <div key={t} className="bg-[#F4F6F5] rounded-xl py-2.5 flex flex-col items-center gap-1">
                <Icon className="h-4 w-4 text-[#E11D2A]" />
                <span className="text-[10.5px] font-semibold text-gray-600">{t}</span>
              </div>
            ))}
          </div>

          {/* Tentang produk */}
          <div className="mt-5">
            <div className="text-[14px] font-extrabold text-gray-900 mb-1.5">Tentang produk</div>
            <p className="text-[13px] text-gray-500 leading-relaxed whitespace-pre-line">{about}</p>
          </div>

          {/* Ulasan customer (data sebenar dari product_reviews) */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <ProductReviews productId={product.id} reviews={reviews} canReview={canReview} />
          </div>

          {/* Produk berkaitan — selalu dibeli bersama (fallback: paling laku / kategori sama) */}
          {related.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="text-[14px] font-extrabold text-gray-900 mb-2.5">Anda mungkin suka</div>
              <div className="grid grid-cols-2 gap-2.5">
                {related.map((r) => (
                  <Link key={r.id} href={`/products/${r.slug}`} className="bg-[#F4F6F5] rounded-xl overflow-hidden">
                    <div className="aspect-square overflow-hidden">
                      {r.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full grid place-items-center text-3xl">🍎</div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-[12px] font-bold text-gray-900 truncate">{r.name}</div>
                      <div className="text-[12px] font-extrabold text-[#E11D2A] mt-0.5">
                        RM{Number(r.price).toFixed(2)}<span className="text-[10px] text-gray-400 font-medium">/{r.unit}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Panduan berkaitan — pautan kluster ke artikel + pillar buah-online */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <div className="text-[14px] font-extrabold text-gray-900 mb-2.5">Panduan berkaitan</div>
            <div className="space-y-2">
              {relatedGuides(cleanName, catName).map((g) => (
                <Link key={g.slug} href={`/panduan/${g.slug}`} className="flex items-center gap-2 text-[13px] text-gray-600 hover:text-gray-900">
                  <Leaf className="h-3.5 w-3.5 text-[#3B7A3B] shrink-0" />
                  <span className="truncate">{g.title}</span>
                </Link>
              ))}
              <Link href="/buah-online" className="flex items-center gap-2 text-[13px] font-semibold text-[#E11D2A] hover:underline">
                <Leaf className="h-3.5 w-3.5 shrink-0" />
                Panduan lengkap beli buah online
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky add bar — kuantiti dikawal di atas; bar ni fokus jumlah + tambah.
          Selepas tambah: "Lihat Troli · RM{jumlah}" (page ni luar SfShell — tiada badge troli). */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {added && cartCount > 0 ? (
            <div className="flex gap-2" data-testid="added-bar">
              <button
                type="button"
                onClick={() => setAdded(false)}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-3.5 text-[14px] font-bold text-gray-900 active:scale-[0.98] transition"
              >
                Tambah lagi
              </button>
              <Link
                href="/cart"
                className="flex-[1.6] inline-flex items-center justify-center gap-2 bg-[#E11D2A] text-white rounded-xl py-3.5 text-[15px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)] active:scale-[0.98] transition"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden />
                Lihat Troli ({cartCount}) · RM{cartTotal.toFixed(2)}
              </Link>
            </div>
          ) : (
            <button
              onClick={add}
              disabled={soldOut}
              className="w-full bg-[#E11D2A] text-white rounded-xl py-3.5 text-[15px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)] active:scale-[0.98] transition disabled:opacity-40 disabled:shadow-none"
            >
              {soldOut ? "Habis stok" : `Tambah ke Troli · RM${total.toFixed(2)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
