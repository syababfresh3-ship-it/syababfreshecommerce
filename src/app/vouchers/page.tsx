import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Ticket } from 'lucide-react'
import { SfShell } from '@/components/storev2/sf-shell'

export const metadata: Metadata = { title: 'Voucher Saya', robots: { index: false, follow: false } }

export default function VouchersPage() {
  return (
    <SfShell>
      <div className="px-4 pt-4 pb-8">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/profile" className="h-9 w-9 grid place-items-center rounded-full -ml-1 text-gray-600 hover:bg-gray-100" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[18px] font-extrabold text-gray-900">Voucher Saya</h1>
        </div>

        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="h-20 w-20 rounded-full bg-[#FDECEC] grid place-items-center mb-5">
            <Ticket className="h-9 w-9 text-[#E11D2A]" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-[17px] font-extrabold text-gray-900">Voucher</h2>
            <span className="text-[9px] font-extrabold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 tracking-wide">AKAN DATANG</span>
          </div>
          <p className="text-[13px] text-gray-400 leading-relaxed max-w-xs">
            Sistem voucher & kod promo sedang dibangunkan. Nanti anda boleh kumpul & tebus voucher di sini.
          </p>
          <Link href="/products" className="mt-7 bg-[#E11D2A] text-white px-6 py-3 rounded-xl text-[13px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)]">
            Beli-belah Dahulu
          </Link>
        </div>
      </div>
    </SfShell>
  )
}
