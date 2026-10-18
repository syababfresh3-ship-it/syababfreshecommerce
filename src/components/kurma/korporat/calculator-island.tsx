'use client'

import { Check } from 'lucide-react'
import { GiftCalculator } from '@/components/kurma/gift-calculator'
import { useRfqSelection } from './rfq-context'

// Calculator (sumber harga sama: lib/gift-pricing) tanpa CTA WA — pilihan dilampir pada RFQ.
// id="kira" dikekalkan supaya KurmaFab sorok bila seksyen ini kelihatan.
export function CalculatorIsland() {
  const { setSel } = useRfqSelection()
  return (
    <section id="kira" className="max-w-2xl mx-auto px-4 pb-14 scroll-mt-16 md:scroll-mt-24">
      <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Anggaran harga segera</h2>
      <p className="text-gray-500 text-center mb-6 text-sm">Harga senarai ikut kuantiti — sebut harga rasmi dihantar selepas butiran disahkan.</p>
      <GiftCalculator angle="korporat" hideCta onChange={setSel} />
      <div className="mt-5 flex items-center justify-center gap-4 text-[12px] text-gray-400 flex-wrap">
        <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />Termasuk kurma</span>
        <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />Design percuma</span>
        <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />Pilihan dilampir pada sebut harga di bawah</span>
      </div>
    </section>
  )
}
