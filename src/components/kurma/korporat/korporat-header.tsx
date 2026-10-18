import Link from 'next/link'
import { KurmaWaLink } from '@/components/kurma/kurma-wa-link'
import { KORPORAT_WA_TEXT } from '@/lib/korporat-copy'
import { shopPath } from '@/lib/kurma-host'

// Header melekat LP korporat — logo + nav anchor + WhatsApp. LP iklan lain tiada header (sengaja);
// page profil syarikat perlu orientasi (sales hantar pautan ini kepada pegawai perolehan).
// Prop (additive, lalai = korporat) supaya LP borong guna header sama tanpa pendua.
const NAV = [
  { href: '#kerja', label: 'Kerja kami' },
  { href: '#proses', label: 'Kenapa kami' },
  { href: '#cara', label: 'Cara tempah' },
  { href: '#faq', label: 'Soalan' },
]

export interface LpHeaderProps {
  nav?: { href: string; label: string }[]
  cta?: { href: string; label: string }
  wa?: { angle: string; label: string; text: string }
}

export function KorporatHeader({ nav = NAV, cta = { href: '#rfq', label: 'Minta sebut harga' }, wa = { angle: 'korporat', label: 'korporat-header', text: KORPORAT_WA_TEXT } }: LpHeaderProps = {}) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href={shopPath('/')} className="shrink-0" aria-label="SyababFresh — laman utama">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/syababfresh-logo.png" alt="SyababFresh" className="h-8 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-[13px] font-semibold text-gray-600" aria-label="Seksyen page">
          {nav.map(n => <a key={n.href} href={n.href} className="hover:text-gray-900">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <a href={cta.href} className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl text-[13px] font-bold text-gray-800 border border-gray-200 hover:border-gray-400">{cta.label}</a>
          <KurmaWaLink angle={wa.angle} label={wa.label} text={wa.text} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold text-white" style={{ background: '#25D366' }}>
            WhatsApp
          </KurmaWaLink>
        </div>
      </div>
    </header>
  )
}
