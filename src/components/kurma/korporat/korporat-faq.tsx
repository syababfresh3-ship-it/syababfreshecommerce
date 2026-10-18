import { ChevronRight } from 'lucide-react'
import { JsonLd, faqPageSchema } from '@/components/seo/json-ld'
import { korporatFaq } from '@/lib/korporat-copy'

// FAQ + FAQPage JSON-LD dari SENARAI YANG SAMA (syarat Google: soalan mesti kelihatan pada page).
export function KorporatFaq() {
  const faq = korporatFaq()
  return (
    <section id="faq" className="max-w-3xl mx-auto px-4 pb-14 scroll-mt-16 md:scroll-mt-24">
      <JsonLd data={faqPageSchema(faq)} />
      <h2 className="text-2xl font-black text-gray-900 text-center mb-6">Soalan lazim</h2>
      <div className="space-y-2.5">
        {faq.map((f, i) => (
          <details key={i} className="group rounded-2xl border border-gray-200 bg-white px-4 py-3.5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-gray-900 text-[15px]">
              {f.q}
              <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-90 shrink-0" />
            </summary>
            <p className="text-sm text-gray-500 mt-2.5 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
