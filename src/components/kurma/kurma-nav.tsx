import Link from 'next/link'
import { KurmaWaLink } from '@/components/kurma/kurma-wa-link'
import { kurmaPath } from '@/lib/kurma-host'

// Menu kongsi mini-site kurma (kurma.syababfresh.my): Gift Box · Korporat · Borong · Portfolio.
// Dulu LP iklan sengaja tiada header (fokus satu CTA); kini subdomain ada 4 page awam yang sales
// hantar pautannya — pelawat mesti boleh tukar ke tawaran yang betul (kedai → borong, pejabat → korporat).
//  - Desktop (md+): melekat; baris 1 = logo + tab page + CTA + WhatsApp; baris 2 (pilihan) = anchor
//    dalam page (korporat/borong) — seksyen sasaran perlu `md:scroll-mt-24` (tinggi 56+36px).
//  - Mobile: TIDAK melekat (jimat skrin; KurmaFab dah cover WhatsApp); tab page = chip scroll mendatar,
//    tiada hamburger. Tab aktif ditebalkan (aria-current).
//  - /studio (hot-lead, noindex) tiada dalam senarai tab tapi tetap papar menu (current='studio' → tiada aktif).
export type KurmaPageId = 'gift' | 'korporat' | 'borong' | 'portfolio' | 'studio'

export const KURMA_PAGES: { id: KurmaPageId; href: string; label: string }[] = [
  { id: 'gift', href: '/', label: 'Gift Box' },
  { id: 'korporat', href: '/korporat', label: 'Korporat' },
  { id: 'borong', href: '/borong', label: 'Borong' },
  { id: 'portfolio', href: '/portfolio', label: 'Portfolio' },
]

export interface KurmaNavProps {
  current: KurmaPageId
  /** Butang WhatsApp header — angle & teks ikut page (label = nama event Lead). */
  wa: { angle?: string; label: string; text: string }
  /** CTA sekunder (desktop sm+), cth '#rfq' Minta sebut harga. */
  cta?: { href: string; label: string }
  /** Anchor dalam page — baris kedua, desktop sahaja. */
  anchors?: { href: string; label: string }[]
}

export function KurmaNav({ current, wa, cta, anchors }: KurmaNavProps) {
  return (
    <header className="bg-white border-b border-gray-100 md:sticky md:top-0 md:z-30 md:bg-white/90 md:backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href={kurmaPath('/')} className="shrink-0" aria-label="Kurma SyababFresh — halaman utama">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/syababfresh-logo.png" alt="SyababFresh" className="h-8 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Halaman kurma">
          {KURMA_PAGES.map(p => {
            const active = p.id === current
            return (
              <Link
                key={p.id}
                href={kurmaPath(p.href)}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {p.label}
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

      {/* Mobile: chip page — scroll mendatar */}
      <nav className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-2.5" aria-label="Halaman kurma">
        {KURMA_PAGES.map(p => {
          const active = p.id === current
          return (
            <Link
              key={p.id}
              href={kurmaPath(p.href)}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {p.label}
            </Link>
          )
        })}
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
