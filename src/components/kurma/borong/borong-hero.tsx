import { ChevronRight, Boxes } from 'lucide-react'
import { KurmaWaLink } from '@/components/kurma/kurma-wa-link'
import { HERO, BORONG_WA_TEXT } from '@/lib/borong-copy'
import { hasStats, type BorongTerms } from '@/lib/borong-pricing'

const RED = '#E11D2A'

export function BorongHero({ photos, terms, updated }: { photos: { url: string; name: string }[]; terms: BorongTerms; updated: string | null }) {
  const s = terms.stats
  const stats = [
    s.yearsWholesale != null ? `${s.yearsWholesale}+ tahun bekal borong` : null,
    s.tradersServed != null ? `${s.tradersServed.toLocaleString('en-MY')}+ peniaga` : null,
    s.cartonsPerSeason != null ? `${s.cartonsPerSeason.toLocaleString('en-MY')}+ karton semusim` : null,
  ].filter((x): x is string => !!x)
  return (
    <section className="max-w-5xl mx-auto px-4 pt-10 pb-8 md:pt-14 md:pb-12 grid md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-10 items-center">
      <div>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#E11D2A] bg-[#FDECEC] px-3 py-1 rounded-full mb-4">
          <Boxes className="h-3.5 w-3.5" />{HERO.eyebrow}
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-gray-900 leading-[1.08] tracking-tight text-balance">
          {HERO.headlineBefore}<span style={{ color: RED }}>{HERO.headlineHighlight}</span>
        </h1>
        <p className="text-gray-500 mt-4 text-base sm:text-lg max-w-xl">{HERO.sub}</p>
        <div className="flex items-center gap-3 mt-7 flex-wrap">
          <a href="#mohon" className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-2xl text-white font-bold text-base" style={{ background: RED }}>
            Mohon harga borong <ChevronRight className="h-5 w-5" />
          </a>
          <KurmaWaLink angle="borong" label="borong-hero" text={BORONG_WA_TEXT} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold text-base" style={{ background: '#25D366' }}>
            WhatsApp terus
          </KurmaWaLink>
        </div>
        {(hasStats(terms) || updated) && (
          <p className="text-[13px] text-gray-500 mt-7 flex flex-wrap gap-x-4 gap-y-1">
            {stats.map(t => <span key={t} className="font-semibold text-gray-700">{t}</span>)}
            {updated && <span className="text-gray-400">Harga rujukan dikemas kini {updated}</span>}
          </p>
        )}
      </div>
      {photos.length > 0 && (
        <div className={`grid gap-3 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {photos.slice(0, 3).map((p, i) => (
            <figure key={p.url} className={`m-0 ${i === 0 && photos.length > 2 ? 'col-span-2' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.name} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} decoding="async" className={`w-full object-cover rounded-2xl border border-gray-200 bg-[#F4F6F5] ${i === 0 && photos.length > 2 ? 'aspect-[2/1]' : 'aspect-square'}`} />
              <figcaption className="text-[11px] text-gray-400 mt-1 text-center">{p.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}
