import Link from 'next/link'
import { COMPANY, addressOneLine } from '@/lib/company'
import { kurmaPath, shopPath } from '@/lib/kurma-host'

// Footer kongsi mini-site kurma — entiti berdaftar, alamat, hubungi, pautan semua page + kedai, polisi.
// Semua fakta dari lib/company.ts. Dulu korporat-footer.tsx (korporat/borong sahaja; LP gift box &
// studio ada baris teks kecil) — kini satu footer sama di 5 page supaya pelawat jumpa page lain.
const LINKS = [
  { href: kurmaPath('/shop'), label: 'Shop — Beli Kurma Online' },
  { href: kurmaPath('/'), label: 'Custom Gift Box Kurma' },
  { href: kurmaPath('/korporat'), label: 'Gift Box Korporat & Agensi' },
  { href: kurmaPath('/borong'), label: 'Kurma Borong (karton)' },
  { href: kurmaPath('/portfolio'), label: 'Portfolio' },
  { href: shopPath('/kategori/kurma'), label: 'Beli runcit — Kurma' },
  { href: shopPath('/'), label: 'Kedai buah SyababFresh' },
]

export function KurmaFooter({ phoneNote = '(gift box & borong)' }: { phoneNote?: string } = {}) {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-8 text-[13px] text-gray-600">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/syababfresh-logo.png" alt="SyababFresh" className="h-8 w-auto mb-3" />
          <p className="font-semibold text-gray-800">{COMPANY.legalName}</p>
          <p className="text-[12px] text-gray-400">{COMPANY.regNo} · {COMPANY.regNoOld}</p>
          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">{addressOneLine()}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Hubungi</p>
          <ul className="space-y-2">
            <li><a href={`https://wa.me/${COMPANY.phoneKurma.wa}`} className="hover:text-gray-900">WhatsApp {COMPANY.phoneKurma.display}</a> <span className="text-gray-400">{phoneNote}</span></li>
            <li><a href={`tel:${COMPANY.phoneKurma.e164}`} className="hover:text-gray-900">Call {COMPANY.phoneKurma.display}</a></li>
            <li><a href={`mailto:${COMPANY.email}`} className="hover:text-gray-900">{COMPANY.email}</a></li>
            <li className="text-gray-400">{COMPANY.hours}</li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Pautan</p>
          <ul className="space-y-2">
            {LINKS.map(l => <li key={l.href}><Link href={l.href} className="hover:text-gray-900">{l.label}</Link></li>)}
            <li><Link href={shopPath('/terma')} className="hover:text-gray-900">Terma &amp; Syarat</Link> · <Link href={shopPath('/privacy')} className="hover:text-gray-900">Privasi</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 pb-8 text-[11px] text-gray-400">© {new Date().getFullYear()} {COMPANY.brand}. Hak cipta terpelihara.</div>
    </footer>
  )
}
