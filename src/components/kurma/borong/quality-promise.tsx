import { qualityPromises, reasons } from '@/lib/borong-copy'
import type { BorongTerms } from '@/lib/borong-pricing'

const RED = '#E11D2A'

export function QualityPromise({ terms }: { terms: BorongTerms }) {
  const items = [...qualityPromises(terms), ...reasons(terms)]
  return (
    <section id="kualiti" className="max-w-5xl mx-auto px-4 pb-14 scroll-mt-16 md:scroll-mt-24">
      <h2 className="text-2xl font-black text-gray-900 text-center text-balance">Apa yang anda boleh harap</h2>
      <p className="text-gray-500 text-center mt-2 text-sm max-w-xl mx-auto">Komitmen kami kepada setiap peniaga — bukan slogan.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-7">
        {items.map(r => (
          <div key={r.t} className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4 bg-white">
            <div className="h-10 w-10 rounded-xl bg-[#FDECEC] grid place-items-center shrink-0"><r.icon className="h-5 w-5" style={{ color: RED }} /></div>
            <div><div className="font-bold text-gray-900">{r.t}</div><div className="text-sm text-gray-500 mt-0.5">{r.d}</div></div>
          </div>
        ))}
      </div>
    </section>
  )
}
