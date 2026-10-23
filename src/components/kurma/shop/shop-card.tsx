'use client'

// Kad produk kedai kurma /shop — beli terus dari kad: produk berukuran (100g/500g/1kg…) buka
// pemilih saiz inline (tiada page detail di subdomain → tiada kandungan pendua), produk tanpa
// variasi terus +/−. Troli = useCartStore kedai (addItem sama → checkout kedai faham item ini).
// Semua produk kurma/kering sekarang guna variasi rata (tiada dimensi TikTok) — jika ada dimensi,
// pautan "Pilih di kedai" ke page produk (hos kurma: proxy lalukan /products).
import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Plus, Minus, ChevronDown, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import type { Product, ProductVariant } from '@/types'
import { rm2, type ShopProduct } from '@/lib/kurma-shop'

const RED = '#E11D2A'
const isOut = (v: ProductVariant) => typeof v.stock === 'number' && v.stock <= 0
// true hanya selepas hydrate di klien (server & render pertama klien = false) — troli dari localStorage
const noop = () => () => {}
const useMounted = () => useSyncExternalStore(noop, () => true, () => false)

function Stepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="shrink-0 flex items-center gap-1 bg-[#FDECEC] rounded-full p-0.5">
      <button type="button" onClick={onDec} className="h-7 w-7 grid place-items-center rounded-full bg-white text-[#E11D2A]" aria-label="Kurang"><Minus className="h-3.5 w-3.5" /></button>
      <span className="text-[13px] font-extrabold text-gray-900 w-5 text-center tabular-nums">{qty}</span>
      <button type="button" onClick={onInc} className="h-7 w-7 grid place-items-center rounded-full text-white" style={{ background: RED }} aria-label="Tambah"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  )
}
function AddBtn({ onClick, label = 'Tambah ke troli' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 h-8 w-8 grid place-items-center rounded-full text-white shadow-[0_4px_12px_rgba(225,29,42,0.32)] active:scale-90 transition" style={{ background: RED }} aria-label={label}>
      <Plus className="h-4 w-4" />
    </button>
  )
}

export function ShopCard({ product }: { product: ShopProduct }) {
  const variants = product.product_variants
  const hasVariants = variants.length > 0
  const hasDims = Array.isArray(product.variant_options) && product.variant_options.length > 0
  const [open, setOpen] = useState(false)
  const mounted = useMounted()

  const items = useCartStore(s => s.items)
  const addItem = useCartStore(s => s.addItem)
  const updateQuantity = useCartStore(s => s.updateQuantity)

  // Objek produk tanpa senarai variasi — jimat localStorage troli (SfProductCard simpan penuh; tak perlu).
  const base = (() => { const { product_variants: _v, ...rest } = product; void _v; return rest as Product })()
  const qtyOf = (variantId: string | null) =>
    mounted ? (items.find(i => i.product.id === product.id && (i.variant?.id ?? null) === variantId)?.quantity ?? 0) : 0
  const inCart = mounted ? items.filter(i => i.product.id === product.id).reduce((n, i) => n + i.quantity, 0) : 0

  const minPrice = hasVariants ? Math.min(...variants.map(v => Number(v.price))) : Number(product.price)
  const soldOut = hasVariants ? variants.every(isOut) : false

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-[#F8F6F1] overflow-hidden">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} loading="lazy" className={`h-full w-full object-cover ${soldOut ? 'opacity-50 grayscale' : ''}`} />
        ) : (
          <div className="h-full grid place-items-center text-gray-300"><ShoppingBag className="h-8 w-8" /></div>
        )}
        {soldOut && <span className="absolute top-2 left-2 bg-gray-900/85 text-white text-[10px] font-bold rounded-full px-2.5 py-1">Habis stok</span>}
        {inCart > 0 && <span className="absolute top-2 right-2 text-white text-[10px] font-bold rounded-full px-2 py-1" style={{ background: RED }}>{inCart} dlm troli</span>}
      </div>

      <div className="p-2.5 flex flex-col flex-1">
        <p className="text-[12.5px] font-bold text-gray-900 leading-snug line-clamp-2 flex-1">{product.name}</p>

        <div className="flex items-end justify-between gap-1.5 mt-1.5">
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold leading-none" style={{ color: RED }}>
              {hasVariants && <span className="text-[10px] font-semibold text-gray-400 mr-0.5">Dari</span>}
              {rm2(minPrice)}
            </p>
            {!hasVariants && <p className="text-[10px] text-gray-400 mt-0.5">/{product.unit}</p>}
            {hasVariants && <p className="text-[10px] text-gray-400 mt-0.5">{variants.length} saiz</p>}
          </div>

          {soldOut ? null : hasDims ? (
            <Link href={`/products/${product.slug}`} className="shrink-0 text-[11px] font-bold text-gray-700 border border-gray-300 rounded-full px-2.5 py-1.5">Pilih di kedai</Link>
          ) : hasVariants ? (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(225,29,42,0.32)] active:scale-95 transition"
              style={{ background: RED }}
            >
              {open ? 'Tutup' : 'Pilih saiz'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          ) : qtyOf(null) === 0 ? (
            <AddBtn onClick={() => addItem(base, 1)} />
          ) : (
            <Stepper qty={qtyOf(null)} onDec={() => updateQuantity(product.id, qtyOf(null) - 1)} onInc={() => updateQuantity(product.id, qtyOf(null) + 1)} />
          )}
        </div>

        {/* Pemilih saiz inline — satu baris per variasi: nama · harga · tambah/stepper */}
        {hasVariants && !hasDims && open && (
          <ul className="mt-2.5 border-t border-gray-100 pt-2 space-y-1.5" aria-label={`Saiz ${product.name}`}>
            {variants.map(v => {
              const q = qtyOf(v.id)
              const out = isOut(v)
              return (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-[12px] font-bold leading-tight ${out ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{v.name}</p>
                    <p className="text-[12px] font-extrabold tabular-nums" style={{ color: out ? '#9CA3AF' : RED }}>
                      {rm2(Number(v.price))}
                      {v.compare_price != null && Number(v.compare_price) > Number(v.price) && (
                        <span className="ml-1 text-[10px] font-semibold text-gray-400 line-through">{rm2(Number(v.compare_price))}</span>
                      )}
                    </p>
                  </div>
                  {out ? <span className="text-[10px] font-bold text-gray-400">Habis</span>
                    : q === 0 ? <AddBtn onClick={() => addItem(base, 1, v)} label={`Tambah ${v.name}`} />
                    : <Stepper qty={q} onDec={() => updateQuantity(product.id, q - 1, v.id)} onInc={() => updateQuantity(product.id, q + 1, v.id)} />}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
