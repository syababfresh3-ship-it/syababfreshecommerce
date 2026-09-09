'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Plus, X } from 'lucide-react'
import { useLpCart } from '@/lib/stores/lp-cart'

// ============================================================
// LpVideo — "video page that takes orders while it plays"
// (gaya Tap2Screen). Video di atas, chip produk di bawah.
// Tekan chip → masuk pesanan (LpCartBar muncul: Bayar Sekarang →
// borang → FPX/e-wallet/COD). Tiada flow baru: guna store & bar
// sedia ada.
//
// Placeholder: {{video:URL|slug1,slug2|caption|sticky|autoplay}}
// ============================================================

// Bentuk minimum yang diperlukan chip — sepadan dengan select di page.tsx
// (bukan `Product` penuh, sebab row LP tak bawa semua lajur).
export interface LpVideoVariant {
  id: string
  name: string
  price: number | string
  compare_price?: number | string | null
  is_active: boolean
  sort_order: number
}
export interface LpVideoProduct {
  id: string
  name: string
  slug: string
  price: number | string
  compare_price?: number | string | null
  image_url?: string | null
  is_active: boolean
  product_variants?: LpVideoVariant[]
}
type LpProduct = LpVideoProduct
type ProductVariant = LpVideoVariant

interface Props {
  url: string
  products: LpProduct[]
  stocks: Record<string, number | null>
  caption?: string
  sticky?: boolean
  autoplay?: boolean
}

// ── Kenal pasti sumber video ─────────────────────────────────
type Source =
  | { kind: 'youtube'; id: string; vertical: boolean }
  | { kind: 'tiktok'; id: string }
  | { kind: 'file'; src: string }
  | { kind: 'unknown' }

export function parseVideoUrl(raw: string): Source {
  const url = raw.trim()
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^(www|m)\./, '')

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      if (id) return { kind: 'youtube', id, vertical: false }
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v')
      if (v) return { kind: 'youtube', id: v, vertical: false }
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{6,})/)
      if (m) return { kind: 'youtube', id: m[2], vertical: m[1] === 'shorts' }
    }
    // Perlu URL penuh (tiktok.com/@user/video/ID). Pautan pendek vm.tiktok.com
    // tak boleh diselesaikan di browser — tampal URL penuh dari butang Share > Copy link.
    if (host === 'tiktok.com') {
      const m = u.pathname.match(/\/video\/(\d+)|\/player\/v1\/(\d+)|\/embed\/v2\/(\d+)/)
      const id = m?.[1] ?? m?.[2] ?? m?.[3]
      if (id) return { kind: 'tiktok', id }
    }
    if (/\.(mp4|webm|m4v)$/i.test(u.pathname)) return { kind: 'file', src: url }
    // URL Supabase Storage tanpa sambungan jelas — cuba mainkan sebagai fail
    if (/\/storage\/v1\/object\/public\//.test(u.pathname)) return { kind: 'file', src: url }
  } catch { /* bukan URL sah */ }
  return { kind: 'unknown' }
}

// ── Pemain video ─────────────────────────────────────────────
function VideoPlayer({ source, autoplay }: { source: Source; autoplay: boolean }) {
  const [vertical, setVertical] = useState(
    source.kind === 'tiktok' || (source.kind === 'youtube' && source.vertical)
  )

  if (source.kind === 'unknown') return null

  // Menegak: hadkan tinggi supaya chip produk masih nampak tanpa scroll.
  // Melintang: lebar penuh, 16:9.
  const frameStyle: React.CSSProperties = vertical
    ? { height: 'min(52vh, 560px)', aspectRatio: '9 / 16', margin: '0 auto' }
    : { width: '100%', aspectRatio: '16 / 9' }

  let inner: React.ReactNode
  if (source.kind === 'youtube') {
    const params = `playsinline=1&rel=0&modestbranding=1${autoplay ? '&autoplay=1&mute=1' : ''}`
    inner = (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${source.id}?${params}`}
        className="w-full h-full"
        title="Video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    )
  } else if (source.kind === 'tiktok') {
    const params = `description=0&music_info=0&rel=0${autoplay ? '&autoplay=1' : ''}`
    inner = (
      <iframe
        src={`https://www.tiktok.com/player/v1/${source.id}?${params}`}
        className="w-full h-full"
        title="Video"
        loading="lazy"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    )
  } else {
    inner = (
      <video
        src={source.src}
        className="w-full h-full object-contain"
        controls
        playsInline
        preload="metadata"
        muted={autoplay}
        autoPlay={autoplay}
        loop={autoplay}
        onLoadedMetadata={e => setVertical(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
      />
    )
  }

  return (
    <div className="bg-black rounded-2xl overflow-hidden">
      <div style={frameStyle}>{inner}</div>
    </div>
  )
}

// ── Chip produk (tekan → masuk pesanan) ──────────────────────
function priceOf(p: LpProduct, v: ProductVariant | null) {
  return Number(v ? v.price : p.price)
}

function activeVariants(p: LpProduct) {
  return (p.product_variants ?? []).filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order)
}

export function LpVideo({ url, products, stocks, caption, sticky = true, autoplay = false }: Props) {
  const source = parseVideoUrl(url)
  const addItem = useLpCart(s => s.addItem)
  const items = useLpCart(s => s.items)
  const [picking, setPicking] = useState<LpProduct | null>(null)

  function add(p: LpProduct, v: ProductVariant | null) {
    addItem({
      productId: p.id,
      variantId: v?.id ?? null,
      productName: p.name,
      variantName: v?.name ?? null,
      qty: 1,
      unitPrice: priceOf(p, v),
      imageUrl: p.image_url ?? null,
    })
    setPicking(null)
    toast.success(`${p.name}${v ? ` (${v.name})` : ''} ditambah! Tekan "Bayar Sekarang" di bawah.`)
  }

  function tap(p: LpProduct) {
    const vars = activeVariants(p)
    if (vars.length > 1) { setPicking(p); return }
    add(p, vars[0] ?? null)
  }

  const qtyInCart = (p: LpProduct) =>
    items.filter(i => i.productId === p.id).reduce((n, i) => n + i.qty, 0)

  if (source.kind === 'unknown' && products.length === 0) return null

  return (
    <>
      <div
        className={sticky
          ? 'sticky z-30 -mx-4 px-4 pt-2 pb-2 bg-white md:static md:mx-0 md:px-0 md:pt-0 md:pb-0'
          : 'py-2'}
        style={sticky ? { top: 53 } : undefined}
      >
        <VideoPlayer source={source} autoplay={autoplay} />

        {caption && (
          <p className="text-xs text-gray-500 text-center mt-2">{caption}</p>
        )}

        {products.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Tekan produk untuk tambah ke pesanan
            </p>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {products.map(p => {
                const stock = stocks[p.id] ?? null
                const soldOut = stock === 0
                const inCart = qtyInCart(p)
                const vars = activeVariants(p)
                const fromPrice = vars.length > 0 ? Math.min(...vars.map(v => Number(v.price))) : Number(p.price)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={soldOut}
                    onClick={() => tap(p)}
                    className="shrink-0 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border-2 bg-white text-left active:scale-[0.97] transition-all disabled:opacity-50"
                    style={inCart > 0
                      ? { borderColor: 'var(--cherry, #16a34a)', background: 'var(--cherry-light, #f0fdf4)' }
                      : { borderColor: 'var(--cherry-border, #e5e7eb)' }}
                  >
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100" loading="lazy" />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold leading-tight truncate max-w-[130px]" style={{ color: 'var(--text, #1f2937)' }}>{p.name}</span>
                      <span className="block text-[12px] font-black leading-tight" style={{ color: 'var(--cherry, #16a34a)' }}>
                        {soldOut ? 'Habis' : `${vars.length > 1 ? 'dari ' : ''}RM${fromPrice.toFixed(2)}`}
                      </span>
                    </span>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-black"
                      style={{ background: inCart > 0 ? 'var(--cherry, #16a34a)' : '#1f2937' }}
                    >
                      {inCart > 0 ? (inCart > 9 ? '9+' : inCart) : <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pilih varian (produk dengan lebih dari satu saiz) */}
      {picking && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPicking(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 leading-tight">{picking.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Pilih saiz / pilihan</p>
              </div>
              <button type="button" onClick={() => setPicking(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-2">
              {activeVariants(picking).map(v => {
                const chosen = items.some(i => i.productId === picking.id && i.variantId === v.id)
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => add(picking, v)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left active:scale-[0.98] transition-all"
                    style={chosen
                      ? { borderColor: 'var(--cherry, #16a34a)', background: 'var(--cherry-light, #f0fdf4)' }
                      : { borderColor: 'var(--cherry-border, #e5e7eb)' }}
                  >
                    <span className="text-sm font-bold text-gray-900">{v.name}</span>
                    <span className="flex items-center gap-2 text-sm font-black" style={{ color: 'var(--cherry, #16a34a)' }}>
                      RM{Number(v.price).toFixed(2)}
                      {chosen && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
