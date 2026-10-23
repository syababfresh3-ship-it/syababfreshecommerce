import Link from 'next/link'
import { KurmaWaLink } from '@/components/kurma/kurma-wa-link'
import { kurmaPath } from '@/lib/kurma-host'

// Menu kongsi mini-site kurma (kurma.syababfresh.my): Gift Box · Korporat · Borong · Portfolio.
// Dulu LP iklan sengaja tiada header (fokus satu CTA); kini subdomain ada 4 page awam yang sales
// hantar pautannya — pelawat mesti boleh tukar ke tawaran yang betul (kedai → borong, pejabat → korporat).
// Gaya: tab teks bergaris bawah (pilihan pemilik 18 Okt; chip pil nampak macam penapis, bukan navigasi).
//  - Desktop (md+): melekat; baris 1 = logo + tab (aktif: tebal + garis merah) + CTA + WhatsApp;
//    baris 2 (pilihan) = anchor dalam page (korporat/borong) — seksyen sasaran perlu `md:scroll-mt-24`.
//  - Mobile: TIDAK melekat (jimat skrin; KurmaFab dah cover WhatsApp); baris 2 = 4 tab seluas skrin,
//    sama lebar, tiada hamburger. Tab aktif ditebalkan (aria-current).
//  - /studio (hot-lead, noindex) tiada dalam senarai tab tapi tetap papar menu (current='studio' → tiada aktif).
export type KurmaPageId = 'gift' | 'shop' | 'korporat' | 'borong' | 'portfolio' | 'studio'

export const KURMA_PAGES: { id: KurmaPageId; href: string; label: string }[] = [
  // Kedai kurma satu page (23 Okt 2026) — beli terus kurma & barang kering, tanpa buah segar.
  // Pemilik mahu Shop di tab paling kiri (23 Okt); page utama subdomain kekal gift box.
  { id: 'shop', href: '/shop', label: 'Shop' },
  { id: 'gift', href: '/', label: 'Gift Box' },
  { id: 'korporat', href: '/korporat', label: 'Korporat' },
  { id: 'borong', href: '/borong', label: 'Borong' },
  { id: 'portfolio', href: '/portfolio', label: 'Portfolio' },
]

const RED = '#E11D2A'

export interface KurmaNavProps {
  /** Tab aktif; tiada (LP builder hos kurma) → semua tab tak aktif. */
  current?: KurmaPageId
  /** Butang WhatsApp header — angle & teks ikut page (label = nama event Lead). */
  wa: { angle?: string; label: string; text: string }
  /** CTA sekunder (desktop sm+), cth '#rfq' Minta sebut harga. */
  cta?: { href: string; label: string }
  /** Anchor dalam page — baris kedua, desktop sahaja. */
  anchors?: { href: string; label: string }[]
}

/** Garis merah di bawah tab aktif — dikongsi tab desktop & mobile. */
function ActiveBar({ inset }: { inset: string }) {
  return <span aria-hidden className={`absolute bottom-0 h-0.5 rounded-full ${inset}`} style={{ background: RED }} />
}

export function KurmaNav({ current, wa, cta, anchors }: KurmaNavProps) {
  return (
    <header className="bg-white border-b border-gray-200 md:sticky md:top-0 md:z-30 md:bg-white/95 md:backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href={kurmaPath('/')} className="shrink-0" aria-label="Kurma SyababFresh — halaman utama">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/syababfresh-logo.png" alt="SyababFresh" className="h-8 w-auto" />
        </Link>

        {/* Desktop: tab teks setinggi header, garis merah di bawah tab aktif */}
        <nav className="hidden md:flex items-stretch self-stretch gap-1" aria-label="Halaman kurma">
          {KURMA_PAGES.map(p => {
            const active = p.id === current
            return (
              <Link
                key={p.id}
                href={kurmaPath(p.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative inline-flex items-center px-3.5 text-[14px] transition ${active ? 'font-bold text-gray-900' : 'font-semibold text-gray-500 hover:text-gray-900'}`}
              >
                {p.label}
                {active ? <ActiveBar inset="inset-x-3.5" /> : null}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {cta ? <a href={cta.href} className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl text-[13px] font-bold text-gray-800 border border-gray-200 hover:border-gray-400">{cta.label}</a> : null}
          <KurmaWaLink angle={wa.angle} label={wa.label} text={wa.text} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold text-white" style={{ background: '#25D366' }}>
            WhatsApp
          </KurmaWaLink>
        </div>
      </div>

      {/* Mobile: 5 tab sama lebar seluas skrin, garis merah di bawah tab aktif */}
      <nav className="md:hidden border-t border-gray-100" aria-label="Halaman kurma">
        <div className="grid grid-cols-5">
          {KURMA_PAGES.map(p => {
            const active = p.id === current
            return (
              <Link
                key={p.id}
                href={kurmaPath(p.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center justify-center h-11 text-[13px] whitespace-nowrap ${active ? 'font-bold text-gray-900' : 'font-semibold text-gray-500'}`}
              >
                {p.label}
                {active ? <ActiveBar inset="inset-x-4" /> : null}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Anchor dalam page (desktop) */}
      {anchors?.length ? (
        <div className="hidden md:block border-t border-gray-100">
          <nav className="max-w-5xl mx-auto px-4 h-9 flex items-center gap-5 text-[12px] font-semibold text-gray-500" aria-label="Seksyen page">
            {anchors.map(a => <a key={a.href} href={a.href} className="hover:text-gray-900">{a.label}</a>)}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
