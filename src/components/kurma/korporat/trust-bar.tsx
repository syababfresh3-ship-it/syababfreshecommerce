import { ShieldCheck, MapPin, Truck, CalendarDays, Building2, Boxes } from 'lucide-react'
import { COMPANY, hasFact } from '@/lib/company'

// Bar kepercayaan — fakta yang BOLEH disahkan (entiti berdaftar, lokasi). Kiraan/tahun hanya
// bila pemilik isi COMPANY.facts (lihat lib/company.ts).
export function TrustBar() {
  const items: { icon: typeof ShieldCheck; text: string }[] = [
    { icon: ShieldCheck, text: `${COMPANY.legalName} · ${COMPANY.regNo}` },
    { icon: MapPin, text: `${COMPANY.address.city}, ${COMPANY.address.state}` },
    { icon: Truck, text: 'Penghantaran seluruh Malaysia' },
  ]
  if (hasFact('foundingYear')) items.push({ icon: CalendarDays, text: `Sejak ${COMPANY.facts.foundingYear}` })
  if (hasFact('orgsServed')) items.push({ icon: Building2, text: `${COMPANY.facts.orgsServed}+ organisasi` })
  if (hasFact('boxesDelivered')) items.push({ icon: Boxes, text: `${Number(COMPANY.facts.boxesDelivered).toLocaleString('en-MY')}+ kotak dihantar` })
  return (
    <section className="border-y border-gray-100 bg-[#FBFAF7]">
      <div className="max-w-5xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] font-semibold text-gray-600">
        {items.map(it => (
          <span key={it.text} className="inline-flex items-center gap-1.5"><it.icon className="h-4 w-4 text-gray-400" />{it.text}</span>
        ))}
      </div>
    </section>
  )
}
