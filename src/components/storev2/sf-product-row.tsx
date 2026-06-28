"use client";

// Redesign v2 — baris produk (Katalog/Home). Thumb + nama + harga + kawalan add.
// Produk ada variant → "+" ke detail (pilih saiz). Tiada variant → stepper terus.
import Link from "next/link";
import { Plus, Minus } from "lucide-react";
import { useCartStore } from "@/lib/stores/cart";
import type { Product, ProductVariant } from "@/types";

type RowProduct = Product & { product_variants?: ProductVariant[] };

export function SfProductRow({ product }: { product: RowProduct }) {
  const variants = (product.product_variants ?? []).filter((v) => v.is_active !== false);
  const hasVariants = variants.length > 0;
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const qty = items.find((i) => i.product.id === product.id && !i.variant)?.quantity ?? 0;
  const minPrice = hasVariants ? Math.min(...variants.map((v) => v.price)) : product.price;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <Link href={`/products/${product.slug}`} className="shrink-0">
        <div className="h-16 w-16 rounded-xl bg-[#F4F6F5] overflow-hidden grid place-items-center">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">🍎</span>
          )}
        </div>
      </Link>

      <Link href={`/products/${product.slug}`} className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-gray-900 truncate">{product.name}</div>
        <div className="text-[15px] font-extrabold text-[#E11D2A] mt-0.5">
          {hasVariants && <span className="text-[11px] font-semibold text-gray-400 mr-1">Dari</span>}
          RM{Number(minPrice).toFixed(2)}
          <span className="text-[11px] font-medium text-gray-400"> /{product.unit}</span>
        </div>
      </Link>

      {hasVariants ? (
        <Link
          href={`/products/${product.slug}`}
          className="shrink-0 h-9 w-9 grid place-items-center rounded-full bg-[#E11D2A] text-white shadow-[0_4px_12px_rgba(225,29,42,0.32)] active:scale-90 transition"
          aria-label="Pilih saiz"
        >
          <Plus className="h-5 w-5" />
        </Link>
      ) : qty === 0 ? (
        <button
          onClick={() => addItem(product, 1)}
          className="shrink-0 h-9 w-9 grid place-items-center rounded-full bg-[#E11D2A] text-white shadow-[0_4px_12px_rgba(225,29,42,0.32)] active:scale-90 transition"
          aria-label="Tambah ke troli"
        >
          <Plus className="h-5 w-5" />
        </button>
      ) : (
        <div className="shrink-0 flex items-center gap-1.5 bg-[#FDECEC] rounded-full p-1">
          <button
            onClick={() => updateQuantity(product.id, qty - 1)}
            className="h-7 w-7 grid place-items-center rounded-full bg-white text-[#E11D2A] active:scale-90 transition"
            aria-label="Kurang"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-[14px] font-extrabold text-gray-900 w-4 text-center">{qty}</span>
          <button
            onClick={() => updateQuantity(product.id, qty + 1)}
            className="h-7 w-7 grid place-items-center rounded-full bg-[#E11D2A] text-white active:scale-90 transition"
            aria-label="Tambah"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
