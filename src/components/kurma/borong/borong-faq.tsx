import { ChevronRight } from 'lucide-react'
import { JsonLd, faqPageSchema } from '@/components/seo/json-ld'
import { borongFaq, segments, type FaqItem } from '@/lib/borong-copy'
import type { BorongTerms } from '@/lib/borong-pricing'

// FAQ umum + per segmen (id="faq-<segmen>" untuk pautan kad). JSON-LD dari senarai yang SAMA dirender.
function Items({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((f, i) => (
        <details key={i} className="group rounded-2xl border border-gray-200 bg-white px-4 py-3.5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-gray-900 text-[15px]">{f.q}<ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-90 shrink-0" /></summary>
          <p className="text-sm text-gray-500 mt-2.5 leading-relaxed">{f.a}</p>
        </details>
      ))}
    </div>
  )
}

export function BorongFaq({ terms }: { terms: BorongTerms }) {
  const all = borongFaq(terms)
  const umum = all.filter(f => !f.segment)
  return (
    <section id="faq" className="max-w-3xl mx-auto px-4 pb-14 scroll-mt-16 md:scroll-mt-24">
      <JsonLd data={faqPageSchema(all)} />
      <h2 className="text-2xl font-black text-gray-900 text-center mb-6">Soalan lazim</h2>
      <Items items={umum} />
      {segments(terms).map(s => {
        const items = all.filter(f => f.segment === s.id)
        if (!items.length) return null
        return (
          <div key={s.id} id={`faq-${s.id}`} className="mt-7 scroll-mt-20 md:scroll-mt-28">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2.5">{s.short}</h3>
            <Items items={items} />
          </div>
        )
      })}
    </section>
  )
}
