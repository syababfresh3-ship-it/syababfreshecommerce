"use client";

// Redesign v2 — kad produk grid (Zus-style): imej kotak + nama + harga + add.
import Link from "next/link";
import { Plus, Minus, Bell } from "lucide-react";
import { useCartStore } from "@/lib/stores/cart";
import type { Product, ProductVariant } from "@/types";

type CardProduct = Product & {
  product_variants?: ProductVariant[];
  product_stock?: { available_stock: number }[]; // embed view (produk tanpa variant)
};

export function SfProductCard({ product }: { product: CardProduct }) {
  const variants = (product.product_variants ?? []).filter((v) => v.is_active !== false);
  const hasVariants = variants.length > 0;
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const qty = items.find((i) => i.product.id === product.id && !i.variant)?.quantity ?? 0;
  const minPrice = hasVariants ? Math.min(...variants.map((v) => v.price)) : product.price;

  // Badge "Habis" — variant: SEMUA variant aktif stok 0; tanpa variant: view
  // product_stock 0. Stok tak dijejak (undefined / tiada row) = anggap ada.
  const soldOut = hasVariants
    ? variants.every((v) => v.stock !== undefined && v.stock <= 0)
    : (product.product_stock?.length ?? 0) > 0 && (product.product_stock![0].available_stock ?? 1) <= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-square bg-[#F4F6F5] overflow-hidden">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className={`h-full w-full object-cover ${soldOut ? "opacity-50 grayscale" : ""}`} />
          ) : (
            <div className="h-full grid place-items-center text-3xl">🍎</div>
          )}
          {soldOut && (
            <span className="absolute top-2 left-2 bg-gray-900/85 text-white text-[10px] font-bold rounded-full px-2.5 py-1">
              Habis stok
            </span>
          )}
        </div>
      </Link>

      <div className="p-2.5 flex flex-col flex-1">
        <Link href={`/products/${product.slug}`} className="flex-1">
          <p className="text-[12.5px] font-bold text-gray-900 leading-snug line-clamp-2">{product.name}</p>
        </Link>

        <div className="flex items-end justify-between gap-1.5 mt-1.5">
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-[#E11D2A] leading-none">
              {hasVariants && <span className="text-[10px] font-semibold text-gray-400 mr-0.5">Dari</span>}
              RM{Number(minPrice).toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">/{product.unit}</p>
          </div>

          {soldOut ? null : hasVariants ? (
            <Link
              href={`/products/${product.slug}`}
              className="shrink-0 h-7 w-7 grid place-items-center rounded-full bg-[#E11D2A] text-white shadow-[0_4px_12px_rgba(225,29,42,0.32)] active:scale-90 transition"
              aria-label="Pilih saiz"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          ) : qty === 0 ? (
            <button
              onClick={() => addItem(product, 1)}
              className="shrink-0 h-7 w-7 grid place-items-center rounded-full bg-[#E11D2A] text-white shadow-[0_4px_12px_rgba(225,29,42,0.32)] active:scale-90 transition"
              aria-label="Tambah ke troli"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="shrink-0 flex items-center gap-1 bg-[#FDECEC] rounded-full p-0.5">
              <button onClick={() => updateQuantity(product.id, qty - 1)} className="h-6 w-6 grid place-items-center rounded-full bg-white text-[#E11D2A]" aria-label="Kurang">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-[12px] font-extrabold text-gray-900 w-4 text-center tabular-nums">{qty}</span>
              <button onClick={() => updateQuantity(product.id, qty + 1)} className="h-6 w-6 grid place-items-center rounded-full bg-[#E11D2A] text-white" aria-label="Tambah">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Habis: butang waitlist baris penuh (elak bertindih dgn harga) */}
        {soldOut && (
          <Link
            href={`/products/${product.slug}`}
            className="mt-2 flex items-center justify-center gap-1 text-[11px] font-bold text-gray-700 border border-gray-300 rounded-full py-1.5 active:scale-[0.98] transition"
          >
            <Bell className="h-3 w-3" /> Bagitahu bila ada
          </Link>
        )}
      </div>
    </div>
  );
}
