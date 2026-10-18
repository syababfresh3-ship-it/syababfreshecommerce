import { ChevronRight, Building2 } from 'lucide-react'
import { KurmaWaLink } from '@/components/kurma/kurma-wa-link'
import { HERO, KORPORAT_WA_TEXT } from '@/lib/korporat-copy'
import { featuredCases, photoAt } from '@/lib/gift-clients'

const RED = '#E11D2A'
// Foto hero = BPMB (#58) — muka kotak korporat paling jelas dalam set foto sebenar.
const HERO_CASE = featuredCases()[0]

export function KorporatHero() {
  const names = featuredCases().slice(0, 5).map(c => c.client.split(' — ')[0])
  return (
    <section className="max-w-5xl mx-auto px-4 pt-10 pb-8 md:pt-14 md:pb-12 grid md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-10 items-center">
      <div>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#E11D2A] bg-[#FDECEC] px-3 py-1 rounded-full mb-4">
          <Building2 className="h-3.5 w-3.5" />{HERO.eyebrow}
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-gray-900 leading-[1.08] tracking-tight text-balance">
          {HERO.headlineBefore}<span style={{ color: RED }}>{HERO.headlineHighlight}</span>
        </h1>
        <p className="text-gray-500 mt-4 text-base sm:text-lg max-w-xl">{HERO.sub}</p>
        <div className="flex items-center gap-3 mt-7 flex-wrap">
          <a href="#rfq" className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-2xl text-white font-bold text-base" style={{ background: RED }}>
            Minta sebut harga rasmi <ChevronRight className="h-5 w-5" />
          </a>
          <KurmaWaLink angle="korporat" label="korporat-hero" text={KORPORAT_WA_TEXT} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold text-base" style={{ background: '#25D366' }}>
            WhatsApp terus
          </KurmaWaLink>
        </div>
        {names.length > 0 && (
          <p className="text-[13px] text-gray-500 mt-7">
            <span className="font-bold uppercase tracking-wide text-[11px] text-gray-400 block mb-1">Antara yang telah mempercayai kami</span>
            {names.join(' · ')} <a href="#kerja" className="underline underline-offset-4 font-semibold text-gray-700">& lain-lain ↓</a>
          </p>
        )}
      </div>
      <figure className="m-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoAt(HERO_CASE.heroIndex)}
          alt={`Gift box kurma untuk ${HERO_CASE.client}`}
          width={1100} height={1100}
          loading="eager" fetchPriority="high" decoding="async"
          className="w-full aspect-square object-cover rounded-3xl border border-gray-200 bg-[#FBFAF7]"
        />
        <figcaption className="text-[12px] text-gray-400 mt-2 text-center">Kotak sebenar yang kami hasilkan untuk {HERO_CASE.client}</figcaption>
      </figure>
    </section>
  )
}
