'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, MessageCircle, MessageSquare, Play, Send, Share2, ShoppingBag, Volume2, VolumeX, X } from 'lucide-react'
import { useLpCart } from '@/lib/stores/lp-cart'
import { freeDeliveryActive } from '@/lib/shipping'
import type { LpLiveConfig } from '@/lib/lp-live'
import { parseVideoUrl, type LpVideoProduct, type LpVideoVariant } from './lp-video'

// ============================================================
// LpLive — template LP gaya TikTok dengan kandungan SEBENAR.
//
// Sengaja TIADA: badge LIVE, kiraan penonton/like, butang Follow, komen
// berskrip. Yang ada: video promosi (label jelas), ulasan pelanggan
// sebenar sebagai komen bergerak, kad produk → checkout LP sedia ada
// (LpCartBar: FPX / e-wallet / COD / bank transfer), Tanya → WhatsApp CS.
// ============================================================

// Dibina di server (page.tsx): nama sudah dipendekkan, tiada data peribadi lain
export interface LiveReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: string      // "Nurul A."
  verified: boolean     // ada order_id → pembeli disahkan
}

// Komen penonton sebenar yang admin dah luluskan (lp_live_comments.status = 'approved')
export interface LiveViewerComment {
  id: string
  name: string
  message: string
  created_at: string
}

// Satu item dalam strim komen bergerak
type StreamItem =
  | { kind: 'review'; id: string; r: LiveReview }
  | { kind: 'comment'; id: string; name: string; message: string; mine?: boolean }

interface Props {
  slug: string
  title: string
  config: LpLiveConfig
  products: LpVideoProduct[]
  stocks: Record<string, number | null>
  reviews: LiveReview[]
  viewerComments: LiveViewerComment[]
  freeMin: number
  waNumber: string
  storeLogo: string
}

const activeVariants = (p: LpVideoProduct) =>
  (p.product_variants ?? []).filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order)

const priceLabel = (p: LpVideoProduct) => {
  const vars = activeVariants(p)
  const from = vars.length > 0 ? Math.min(...vars.map(v => Number(v.price))) : Number(p.price)
  return `${vars.length > 1 ? 'dari ' : ''}RM${from.toFixed(2)}`
}
const PriceText = ({ p }: { p: LpVideoProduct }) => {
  const vars = activeVariants(p)
  const from = vars.length > 0 ? Math.min(...vars.map(v => Number(v.price))) : Number(p.price)
  return <>{vars.length > 1 && <span className="text-[11px] font-semibold opacity-80">dari </span>}RM{from.toFixed(2)}</>
}

function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="rounded-full object-cover bg-white/10 shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-white/20 text-white font-black flex items-center justify-center shrink-0" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function LpLive({ slug, title, config, products, stocks, reviews, viewerComments, freeMin, waNumber, storeLogo }: Props) {
  const source = parseVideoUrl(config.video_url)
  const addItem = useLpCart(s => s.addItem)
  const items = useLpCart(s => s.items)
  const cartCount = items.reduce((n, i) => n + i.qty, 0)
  const cartTotal = items.reduce((n, i) => n + i.unitPrice * i.qty, 0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(config.autoplay)
  const [playing, setPlaying] = useState(config.autoplay)
  const [pinnedSlug, setPinnedSlug] = useState(config.pinned_product || products[0]?.slug || '')
  const [bagOpen, setBagOpen] = useState(false)
  const [picking, setPicking] = useState<LpVideoProduct | null>(null)
  const [mounted, setMounted] = useState(false)
  const [noteOpen, setNoteOpen] = useState(true)
  const [commentOpen, setCommentOpen] = useState(false)
  const [cForm, setCForm] = useState({ name: '', message: '', phone: '', website: '' })  // website = honeypot
  const [cSending, setCSending] = useState(false)
  const [mine, setMine] = useState<StreamItem[]>([])  // komen penonton ini sendiri (papar serta-merta, berlabel)

  const pinned = products.find(p => p.slug === pinnedSlug) ?? products[0]
  const freeOn = freeDeliveryActive(freeMin)
  const avatar = config.host_avatar_url || storeLogo || ''

  useEffect(() => setMounted(true), [])

  // Kunci scroll body — page ini penuh skrin. data-lp-live: banner PWA global tak akan muncul
  // (ia tutup toolbar & butang Beli). Effect anak jalan sebelum effect layout, jadi tanda sempat dibaca.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.dataset.lpLive = '1'
    return () => {
      document.body.style.overflow = prev
      delete document.documentElement.dataset.lpLive
    }
  }, [])

  // React tak selalu set atribut `muted` pada render pertama → set terus pada DOM
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = muted
    if (config.autoplay) v.play().catch(() => {})
  }, [muted, config.autoplay])

  // ── Komen bergerak = ulasan sebenar + komen penonton yang diluluskan ──
  // Papar `reviews_visible` gelembung serentak (default 1 supaya tak tutup video),
  // tukar setiap 5 saat. Komen sendiri (belum semak) dipapar dulu, berlabel.
  const visible = Math.min(4, Math.max(1, config.reviews_visible || 1))
  const stream = useMemo<StreamItem[]>(() => {
    const items: StreamItem[] = [...mine]
    viewerComments.forEach(c => items.push({ kind: 'comment', id: `c-${c.id}`, name: c.name, message: c.message }))
    if (config.show_reviews) reviews.filter(r => (r.comment ?? '').trim().length > 0).forEach(r => items.push({ kind: 'review', id: `r-${r.id}`, r }))
    return items
  }, [reviews, viewerComments, mine, config.show_reviews])
  const [shown, setShown] = useState<{ k: number; it: StreamItem }[]>([])
  const seq = useRef(0)  // kunci unik merentas re-run effect (StrictMode dev jalan effect 2x)
  useEffect(() => {
    setShown([])
    if (stream.length === 0) return
    if (stream.length <= visible) { setShown(stream.map(it => ({ k: seq.current++, it }))); return }
    let i = 0
    const push = () => {
      const it = stream[i % stream.length]
      i++
      setShown(prev => [...prev.slice(-(visible - 1)), { k: seq.current++, it }].slice(-visible))
    }
    push()
    const id = setInterval(push, 5000)
    return () => clearInterval(id)
  }, [stream, visible])

  // ── Hantar komen penonton (disimpan 'pending', admin luluskan) ──
  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (cForm.name.trim().length < 2) { toast.error('Sila isi nama'); return }
    if (!cForm.message.trim()) { toast.error('Sila tulis komen'); return }
    setCSending(true)
    try {
      const res = await fetch(`/api/lp/${slug}/comment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cForm),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error ?? 'Gagal hantar komen'); return }
      setMine(m => [{ kind: 'comment', id: `m-${Date.now()}`, name: cForm.name.trim(), message: cForm.message.trim(), mine: true }, ...m])
      setCForm(f => ({ ...f, message: '' }))
      setCommentOpen(false)
      toast.success('Terima kasih! Komen anda dipaparkan selepas disemak.')
    } finally { setCSending(false) }
  }

  // ── Beli ────────────────────────────────────────────────────
  function add(p: LpVideoProduct, v: LpVideoVariant | null) {
    addItem({
      productId: p.id,
      variantId: v?.id ?? null,
      productName: p.name,
      variantName: v?.name ?? null,
      qty: 1,
      unitPrice: Number(v ? v.price : p.price),
      imageUrl: p.image_url ?? null,
    })
    setPicking(null)
    setBagOpen(false)
    toast.success(`${p.name}${v ? ` (${v.name})` : ''} ditambah`)
    // Terus buka drawer checkout LpCartBar (borang → bayar)
    setTimeout(() => window.dispatchEvent(new Event('lp-cart:open')), 0)
  }

  function buy(p: LpVideoProduct) {
    if ((stocks[p.id] ?? null) === 0) { toast.error('Maaf, stok habis'); return }
    const vars = activeVariants(p)
    if (vars.length > 1) { setPicking(p); return }
    add(p, vars[0] ?? null)
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (muted) { setMuted(false); v.muted = false; v.play().catch(() => {}); setPlaying(true); return }
    if (v.paused) { v.play().catch(() => {}); setPlaying(true) } else { v.pause(); setPlaying(false) }
  }

  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(config.wa_prefill || `Hai SyababFresh, saya ada soalan tentang "${title}"`)}`

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (navigator.share) { try { await navigator.share({ title, url }) } catch { /* batal */ } return }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`, '_blank', 'noopener')
  }

  // ── Video ───────────────────────────────────────────────────
  let media: React.ReactNode = null
  if (source.kind === 'file') {
    media = (
      <video
        ref={videoRef}
        src={source.src}
        poster={config.poster_url || undefined}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        loop
        autoPlay={config.autoplay}
        muted={muted}
        preload="metadata"
        onClick={togglePlay}
      />
    )
  } else if (source.kind === 'youtube') {
    media = (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${source.id}?playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${source.id}${config.autoplay ? '&autoplay=1&mute=1' : ''}`}
        className="absolute inset-0 w-full h-full"
        title="Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    )
  } else if (source.kind === 'tiktok') {
    media = (
      <iframe
        src={`https://www.tiktok.com/player/v1/${source.id}?description=0&music_info=0&rel=0${config.autoplay ? '&autoplay=1' : ''}`}
        className="absolute inset-0 w-full h-full"
        title="Video"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    )
  }
  const isFile = source.kind === 'file'

  return (
    // Mobile: penuh skrin. Desktop: bingkai 9:16 di tengah, latar gelap.
    <div className="fixed inset-0 z-[45] bg-neutral-950 sm:flex sm:items-center sm:justify-center">
      <div className="relative w-full h-[100dvh] sm:w-[430px] sm:h-[min(92vh,860px)] sm:rounded-3xl overflow-hidden bg-black text-white select-none">
        {media}

        {/* Gradien supaya teks terbaca */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* Header: kedai + label jujur */}
        <div className="absolute top-0 inset-x-0 p-3 flex items-center gap-2">
          <Avatar src={avatar} name={config.host_name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-tight truncate">{config.host_name}</p>
            {config.host_tagline && <p className="text-[11px] text-white/70 leading-tight truncate">{config.host_tagline}</p>}
          </div>
          {isFile && (
            <button type="button" onClick={togglePlay} aria-label={muted ? 'Buka suara' : 'Senyapkan'} className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          <Link href="/" aria-label="Tutup" className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center">
            <X className="h-4 w-4" />
          </Link>
        </div>

        {/* Buka suara / main */}
        {isFile && (muted || !playing) && (
          <button type="button" onClick={togglePlay} className="absolute z-10 left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 bg-black/60 backdrop-blur px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap">
            {!playing ? <Play className="h-4 w-4" strokeWidth={2.5} /> : <VolumeX className="h-4 w-4" />}
            {!playing ? 'Main video' : 'Tekan untuk buka suara'}
          </button>
        )}

        {/* Bahagian bawah: nota, ulasan, kad produk, toolbar */}
        <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
          {config.pinned_note && noteOpen && (
            <div className="relative border-l-2 border-white/80 bg-black/50 backdrop-blur rounded-r-xl pl-3 pr-8 py-1.5 max-w-[78%]">
              <p className="text-[11px] leading-snug text-white/90">{config.pinned_note}</p>
              <button type="button" onClick={() => setNoteOpen(false)} aria-label="Tutup nota" className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-white/70 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {shown.length > 0 && (
            <div className="max-w-[80%] space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Ulasan &amp; komen sebenar</p>
              {shown.map(({ k, it }) => (
                <div key={k} className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <Avatar name={it.kind === 'review' ? it.r.reviewer : it.name} size={26} />
                  <div className="bg-black/45 backdrop-blur rounded-2xl px-3 py-1.5 min-w-0">
                    {it.kind === 'review' ? (
                      <>
                        <p className="text-[11px] text-white/70 leading-tight truncate">
                          {it.r.reviewer}{it.r.verified ? ' · Pembeli disahkan' : ' · Ulasan'}
                        </p>
                        <p className="text-xs leading-snug">
                          <span className="text-white/90 tracking-tight">{'★'.repeat(it.r.rating)}</span>
                          <span className="text-white/30 tracking-tight">{'★'.repeat(5 - it.r.rating)}</span>{' '}
                          {(it.r.comment ?? '').slice(0, 110)}{(it.r.comment ?? '').length > 110 ? '…' : ''}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] text-white/70 leading-tight truncate">
                          {it.name}{it.mine ? ' · Anda (menunggu semakan)' : ' · Penonton'}
                        </p>
                        <p className="text-xs leading-snug">{it.message.slice(0, 140)}{it.message.length > 140 ? '…' : ''}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pinned && (
            <div className="rounded-2xl bg-white text-gray-900 p-2.5 flex items-center gap-3 shadow-xl">
              {pinned.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pinned.image_url} alt="" className="w-16 h-16 rounded-xl object-cover bg-gray-100 shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black leading-tight truncate">{pinned.name}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                  {(() => {
                    const s = stocks[pinned.id] ?? null
                    const bits = [
                      s === null ? null : s > 0 ? `Stok ${s}` : 'Habis',
                      freeOn ? `Hantar percuma RM${freeMin}+` : null,
                    ].filter(Boolean)
                    return bits.join(' · ') || 'Tekan Beli untuk pesan'
                  })()}
                </p>
                <p className="text-base font-black leading-tight mt-0.5 whitespace-nowrap" style={{ color: 'var(--cherry, #16a34a)' }}>
                  <PriceText p={pinned} />
                  {pinned.compare_price && Number(pinned.compare_price) > Number(pinned.price) && (
                    <span className="ml-1.5 text-xs text-gray-400 line-through font-semibold">RM{Number(pinned.compare_price).toFixed(2)}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => buy(pinned)}
                disabled={(stocks[pinned.id] ?? null) === 0}
                className="shrink-0 px-4 py-3 rounded-xl text-white text-sm font-black active:scale-[0.97] transition-all disabled:opacity-40"
                style={{ background: 'var(--cherry, #16a34a)' }}
              >
                {(stocks[pinned.id] ?? null) === 0 ? 'Habis' : config.buy_label}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setBagOpen(true)} aria-label="Senarai produk" className="relative w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-gray-900 text-[10px] font-black flex items-center justify-center">{products.length}</span>
            </button>
            {config.allow_comments ? (
              <>
                <button type="button" onClick={() => setCommentOpen(true)} className="flex-1 h-11 rounded-full bg-white/15 backdrop-blur flex items-center gap-2 px-4 text-sm text-white/80 text-left min-w-0">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">Tulis komen...</span>
                </button>
                <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Tanya di WhatsApp" className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5" />
                </a>
              </>
            ) : (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex-1 h-11 rounded-full bg-white/15 backdrop-blur flex items-center gap-2 px-4 text-sm text-white/90">
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">Tanya kami di WhatsApp</span>
              </a>
            )}
            {mounted && cartCount > 0 ? (
              <button type="button" onClick={() => window.dispatchEvent(new Event('lp-cart:open'))} className="h-11 px-4 rounded-full text-white text-sm font-black shrink-0 flex items-center gap-1.5" style={{ background: 'var(--cherry, #16a34a)' }}>
                Bayar · RM{cartTotal.toFixed(2)}
              </button>
            ) : (
              <button type="button" onClick={share} aria-label="Kongsi" className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                <Share2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Komen penonton — disimpan, dipaparkan selepas admin semak (jujur, tiada komen rekaan) */}
        {commentOpen && (
          <div className="absolute inset-0 z-20 flex items-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => !cSending && setCommentOpen(false)} />
            <form onSubmit={sendComment} className="relative w-full bg-white text-gray-900 rounded-t-3xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black leading-tight">Tulis komen</p>
                  <p className="text-xs text-gray-500 mt-0.5">Komen dipaparkan selepas disemak oleh kami.</p>
                </div>
                <button type="button" onClick={() => setCommentOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
              </div>
              <input value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} maxLength={40} placeholder="Nama anda" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              <textarea value={cForm.message} onChange={e => setCForm(f => ({ ...f, message: e.target.value }))} maxLength={200} rows={3} placeholder="Contoh: Masih ada stok? Sampai Johor berapa hari?" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
              <input value={cForm.phone} onChange={e => setCForm(f => ({ ...f, phone: e.target.value }))} inputMode="tel" placeholder="No. WhatsApp (pilihan, kalau nak kami balas)" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              {/* Honeypot — bot isi, manusia tak nampak */}
              <input value={cForm.website} onChange={e => setCForm(f => ({ ...f, website: e.target.value }))} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute opacity-0 h-0 w-0 pointer-events-none" />
              <button type="submit" disabled={cSending} className="w-full py-3 rounded-xl text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'var(--cherry, #16a34a)' }}>
                <Send className="h-4 w-4" />{cSending ? 'Menghantar...' : 'Hantar komen'}
              </button>
            </form>
          </div>
        )}

        {/* Beg: senarai produk */}
        {bagOpen && (
          <div className="absolute inset-0 z-20 flex items-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setBagOpen(false)} />
            <div className="relative w-full bg-white text-gray-900 rounded-t-3xl max-h-[70%] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                <p className="font-black">Produk dalam video ({products.length})</p>
                <button type="button" onClick={() => setBagOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
              </div>
              <div className="overflow-y-auto divide-y divide-gray-100">
                {products.map(p => {
                  const s = stocks[p.id] ?? null
                  const inCart = items.filter(i => i.productId === p.id).reduce((n, i) => n + i.qty, 0)
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <button type="button" onClick={() => { setPinnedSlug(p.slug); setBagOpen(false) }} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100 shrink-0" />
                        ) : <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-tight truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">{s === 0 ? 'Habis' : priceLabel(p)}{inCart > 0 ? ` · ${inCart} dalam pesanan` : ''}</p>
                        </div>
                      </button>
                      <button type="button" onClick={() => buy(p)} disabled={s === 0} className="shrink-0 px-3 py-2 rounded-xl text-white text-xs font-black disabled:opacity-40 flex items-center gap-1" style={{ background: 'var(--cherry, #16a34a)' }}>
                        {inCart > 0 ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}{s === 0 ? 'Habis' : 'Tambah'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Pilih saiz (produk dengan lebih dari satu varian) */}
        {picking && (
          <div className="absolute inset-0 z-30 flex items-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setPicking(null)} />
            <div className="relative w-full bg-white text-gray-900 rounded-t-3xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-black leading-tight">{picking.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pilih saiz / pilihan</p>
                </div>
                <button type="button" onClick={() => setPicking(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
              </div>
              <div className="space-y-2">
                {activeVariants(picking).map(v => (
                  <button key={v.id} type="button" onClick={() => add(picking, v)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 text-left active:scale-[0.98] transition-all">
                    <span className="text-sm font-bold">{v.name}</span>
                    <span className="text-sm font-black" style={{ color: 'var(--cherry, #16a34a)' }}>RM{Number(v.price).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
