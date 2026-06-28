"use client";

// Redesign v2 — Produk detail (pushed screen): hero + pemilih variant + benefit + sticky add.
// Seksyen I: nama bersih (buang saiz), label dinamik (Saiz/Pakej), harga per-unit + jimat,
// kuantiti berasingan dari variant, penunjuk stok.
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Heart, Star, Leaf, Truck, RotateCcw, Plus, Minus, Check } from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/lib/stores/cart";
import type { Product, ProductVariant } from "@/types";

type DetailProduct = Product & {
  categories?: { name: string; slug: string } | null;
  product_variants?: ProductVariant[];
};

// Hurai nama variant → kiraan bundle + unit + sama ada ia berat.
function parseVariant(name: string): { count: number; unit: string; weight: boolean } {
  const m = name.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z/]+)/);
  if (!m) return { count: 1, unit: name.trim(), weight: false };
  const num = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const weight = /^(g|gram|kg|kgm|kilo|kilogram|ml|l|liter|litre)/.test(unit);
  return { count: weight ? 1 : num, unit, weight };
}

export function SfProduct({ product }: { product: DetailProduct }) {
  const variants = (product.product_variants ?? [])
    .filter((v) => v.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const hasVariants = variants.length > 0;

  const [variant, setVariant] = useState<ProductVariant | null>(hasVariants ? variants[0] : null);
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  // #1 Buang saiz/berat dalam kurungan dari nama (paparan sahaja): "Sweet Lychee (500Gram)" → "Sweet Lychee".
  const cleanName = product.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || product.name;

  // #2 Label dinamik: variant berat → "Pilih Saiz"; bundle (pack/botol) → "Pilih Pakej".
  const allWeight = hasVariants && variants.every((v) => parseVariant(v.name).weight);
  const pickerLabel = allWeight ? "Pilih Saiz" : "Pilih Pakej";

  const unitPrice = variant?.price ?? product.price;
  const total = unitPrice * qty;
  const catName = product.categories?.name;

  // #5 Penunjuk stok (dari variant terpilih).
  const stock = variant?.stock;
  const soldOut = stock !== undefined && stock <= 0;
  const lowStock = stock !== undefined && stock > 0 && stock <= 10;

  const about =
    product.description?.trim() ||
    `${cleanName} segar pilihan SyababFresh — disimpan sejuk dan dihantar terus untuk kekalkan kesegaran. Sesuai dimakan terus atau jadi hidangan keluarga.`;

  function add() {
    if (soldOut) return;
    addItem(product, qty, variant);
    toast.success(`${qty}× ${cleanName}${variant ? ` (${variant.name})` : ""} ditambah ke troli`);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur px-3 h-[52px] flex items-center">
        <Link href="/products" className="h-10 w-10 grid place-items-center -ml-1" aria-label="Kembali">
          <ChevronLeft className="h-6 w-6 text-gray-900" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Hero — kotak seragam (ikut design lama): object-cover, semua produk sama bentuk */}
        <div className="relative mx-4 sm:mx-auto sm:max-w-md aspect-square rounded-2xl bg-gradient-to-b from-[#fdf8f2] to-[#f0e8dc] overflow-hidden">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={cleanName} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-7xl">🍎</div>
          )}
          {catName && (
            <span className="absolute top-3 left-3 bg-gray-900 text-white text-[10px] font-bold rounded-full px-2.5 py-1">{catName}</span>
          )}
          <button
            onClick={() => setLiked((v) => !v)}
            className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-white shadow"
            aria-label="Senarai suka"
          >
            <Heart className={`h-5 w-5 ${liked ? "fill-[#E11D2A] text-[#E11D2A]" : "text-gray-400"}`} />
          </button>
        </div>

        {/* Info */}
        <div className="px-4 pt-4 max-w-2xl mx-auto">
          {catName && <div className="text-[11px] font-bold text-[#E11D2A] uppercase tracking-wide">{catName}</div>}
          <h1 className="text-[22px] font-extrabold text-gray-900 mt-0.5 leading-tight">{cleanName}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-[13px] font-bold text-gray-900">4.9</span>
            <span className="text-[12px] text-gray-400">(128 ulasan)</span>
          </div>
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
                      onClick={() => setVariant(v)}
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
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-8 w-8 grid place-items-center rounded-full bg-white text-gray-900" aria-label="Kurang">
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-[15px] font-extrabold text-gray-900 w-6 text-center">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="h-8 w-8 grid place-items-center rounded-full bg-white text-gray-900" aria-label="Tambah">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

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
        </div>
      </div>

      {/* Sticky add bar — kuantiti dikawal di atas; bar ni fokus jumlah + tambah */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={add}
            disabled={soldOut}
            className="w-full bg-[#E11D2A] text-white rounded-xl py-3.5 text-[15px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)] active:scale-[0.98] transition disabled:opacity-40 disabled:shadow-none"
          >
            {soldOut ? "Habis stok" : `Tambah ke Troli · RM${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
