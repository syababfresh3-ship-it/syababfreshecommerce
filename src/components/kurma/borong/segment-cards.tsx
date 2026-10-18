'use client'

import { ChevronRight } from 'lucide-react'
import { segments, type SegmentId } from '@/lib/borong-copy'
import type { BorongTerms } from '@/lib/borong-pricing'
import { useBorong } from './borong-context'

const RED = '#E11D2A'

// 4 laluan segmen — "Mohon harga" pra-isi jenis perniagaan dalam borang; "Soalan" lompat ke FAQ segmen.
export function SegmentCards({ terms }: { terms: BorongTerms }) {
  const { setSegment } = useBorong()
  const go = (id: SegmentId) => { setSegment(id); document.getElementById('mohon')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  return (
    <section id="segmen" className="max-w-5xl mx-auto px-4 pt-12 pb-12 scroll-mt-16">
      <h2 className="text-2xl font-black text-gray-900 text-center text-balance">Anda beli untuk apa?</h2>
      <p className="text-gray-500 text-center mt-2 text-sm max-w-xl mx-auto">Pilih — kami tunjuk terma & soalan yang berkaitan dengan perniagaan anda.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-7">
        {segments(terms).map(s => (
          <div key={s.id} className="rounded-2xl border border-gray-200 p-4 bg-white flex flex-col">
            <div className="h-10 w-10 rounded-xl bg-[#FDECEC] grid place-items-center"><s.icon className="h-5 w-5" style={{ color: RED }} /></div>
            <div className="font-bold text-gray-900 mt-3 leading-snug">{s.label}</div>
            <div className="text-[13px] text-gray-500 mt-1">{s.blurb}</div>
            <ul className="text-[12px] text-gray-600 mt-2 space-y-1 list-disc pl-4">{s.bullets.map(b => <li key={b}>{b}</li>)}</ul>
            <div className="mt-auto pt-3 flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => go(s.id)} className="inline-flex items-center gap-1 text-[13px] font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: RED }}>Mohon harga <ChevronRight className="h-4 w-4" /></button>
              <a href={`#faq-${s.id}`} className="text-[12px] font-semibold text-gray-500 underline underline-offset-4 hover:text-gray-800">Soalan</a>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
