import { CalendarDays } from 'lucide-react'
import { hasRamadan, type BorongTerms } from '@/lib/borong-pricing'

export function RamadanCalendar({ terms }: { terms: BorongTerms }) {
  if (!hasRamadan(terms)) return null
  const r = terms.ramadan
  return (
    <section id="ramadan" className="max-w-5xl mx-auto px-4 pb-14 scroll-mt-16">
      <div className="rounded-3xl border border-gray-200 bg-[#FBFAF7] p-6 sm:p-8 grid sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="h-12 w-12 rounded-2xl bg-[#FDECEC] grid place-items-center"><CalendarDays className="h-6 w-6" style={{ color: '#E11D2A' }} /></div>
        <div>
          <h2 className="text-xl font-black text-gray-900">Pra-tempah Ramadan</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
            {r.preorderOpen && <><dt className="text-gray-500">Dibuka</dt><dd className="font-semibold text-gray-900">{r.preorderOpen}</dd></>}
            {r.preorderClose && <><dt className="text-gray-500">Ditutup</dt><dd className="font-semibold text-gray-900">{r.preorderClose}</dd></>}
            {r.deliveryWindow && <><dt className="text-gray-500">Penghantaran</dt><dd className="font-semibold text-gray-900">{r.deliveryWindow}</dd></>}
          </dl>
          {r.priceLockNote && <p className="text-sm text-gray-600 mt-3">{r.priceLockNote}</p>}
        </div>
      </div>
    </section>
  )
}
