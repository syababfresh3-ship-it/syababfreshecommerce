import { Boxes, Truck, CreditCard, RotateCcw, FlaskConical, Clock, Store } from 'lucide-react'
import { hasTerms, rm, type BorongTerms } from '@/lib/borong-pricing'
import { COMPANY } from '@/lib/company'

// Terma & tangga kuantiti — setiap kad hanya bila terma itu diisi pemilik (lib/borong-pricing.ts).
export function TermsTiers({ terms: t }: { terms: BorongTerms }) {
  if (!hasTerms(t)) return null
  const cards: { icon: typeof Boxes; t: string; d: string }[] = []
  if (t.moqCtn != null) cards.push({ icon: Boxes, t: `Minimum ${t.moqCtn} karton`, d: t.mixAllowed ? 'Boleh campur jenis kurma dalam satu pesanan.' : t.mixAllowed === false ? 'Minimum dikira per jenis kurma.' : 'Kuantiti kecil? WhatsApp kami.' })
  else if (t.mixAllowed) cards.push({ icon: Boxes, t: 'Boleh campur jenis', d: 'Gabungkan beberapa jenis kurma dalam satu pesanan.' })
  if (t.leadTime) cards.push({ icon: Clock, t: 'Masa proses', d: t.leadTime })
  if (t.delivery.freeAboveRm != null || t.delivery.note) cards.push({ icon: Truck, t: t.delivery.freeAboveRm != null ? `Hantar percuma ${rm(t.delivery.freeAboveRm)} ke atas` : 'Penghantaran', d: t.delivery.note ?? 'Kurier ke seluruh Malaysia.' })
  if (t.delivery.pickup) cards.push({ icon: Store, t: `Ambil sendiri di ${COMPANY.address.city}`, d: `${COMPANY.hours} · ${COMPANY.address.line1}` })
  if (t.payment.methods.length || t.payment.creditNote) cards.push({ icon: CreditCard, t: 'Bayaran', d: [t.payment.methods.join(' / '), t.payment.creditNote].filter(Boolean).join(' · ') })
  if (t.returns.note) cards.push({ icon: RotateCcw, t: 'Pulangan', d: t.returns.note })
  if (t.sample.available) cards.push({ icon: FlaskConical, t: 'Sampel', d: t.sample.note ?? 'WhatsApp kami untuk atur sampel.' })
  return (
    <section id="terma" className="max-w-5xl mx-auto px-4 pb-14 scroll-mt-16 md:scroll-mt-24">
      <h2 className="text-2xl font-black text-gray-900 text-center">Terma borong</h2>
      {t.tiers.length > 0 && (
        <div className="mt-6 rounded-2xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#FBFAF7] text-[11px] font-bold uppercase tracking-wide text-gray-400"><tr><th className="text-left px-4 py-2.5">Tier</th><th className="text-left px-4 py-2.5">Kuantiti / bulan</th><th className="text-left px-4 py-2.5">Manfaat</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {t.tiers.map(x => <tr key={x.id}><td className="px-4 py-3 font-bold text-gray-900">{x.label}</td><td className="px-4 py-3 text-gray-700 tabular-nums">{x.minCtn}{x.maxCtn != null ? `–${x.maxCtn}` : '+'} karton</td><td className="px-4 py-3 text-gray-600">{x.benefit}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      {cards.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          {cards.map(c => (
            <div key={c.t} className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4 bg-white">
              <div className="h-10 w-10 rounded-xl bg-[#FDECEC] grid place-items-center shrink-0"><c.icon className="h-5 w-5" style={{ color: '#E11D2A' }} /></div>
              <div><div className="font-bold text-gray-900">{c.t}</div><div className="text-sm text-gray-500 mt-0.5">{c.d}</div></div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
