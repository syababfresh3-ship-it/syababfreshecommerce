import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { PRODUCT_PHOTOS } from '@/lib/gift'
import { GIFT_CLIENTS } from '@/lib/gift-copy'
import { PhotoGallery } from '@/components/kurma/photo-gallery'

export const metadata: Metadata = {
  // absolute: elak template root tambah "| SyababFresh" sekali lagi (pendua)
  title: { absolute: 'Portfolio — Custom Gift Box Kurma | SyababFresh' },
  description: 'Koleksi kotak hadiah kurma custom yang telah kami hasilkan untuk korporat, agensi kerajaan & individu.',
}

// Antara klien yang pernah kami hasilkan kotak (kredibiliti) — satu sumber di gift-copy.
const CLIENTS = GIFT_CLIENTS

export default function PortfolioPage() {
  const total = PRODUCT_PHOTOS.length

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-12 pb-8 text-center">
        <Link href="/kurma" className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-400 hover:text-gray-600 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />Custom Gift Kurma
        </Link>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#E11D2A] bg-[#FDECEC] px-3 py-1 rounded-full mb-4 mx-auto">
          Portfolio · {total}+ kotak
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight">Kerja custom box yang kami hasilkan.</h1>
        <p className="text-gray-500 mt-3 text-base max-w-2xl mx-auto">Kotak hadiah kurma custom untuk korporat, agensi kerajaan &amp; individu — reka ikut citarasa &amp; jenama anda.</p>
        <Link href="/kurma#kira" className="inline-flex items-center gap-1.5 mt-6 px-6 py-3.5 rounded-2xl text-white font-bold text-base" style={{ background: '#E11D2A' }}>
          Reka kotak anda <ChevronRight className="h-5 w-5" />
        </Link>
      </section>

      {/* Produk siap — foto sebenar */}
      {PRODUCT_PHOTOS.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-10">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">Produk siap</h2>
              <p className="text-[12px] text-gray-400">Kotak sebenar yang telah kami hasilkan &amp; hantar</p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{PRODUCT_PHOTOS.length} foto</span>
          </div>
          <PhotoGallery photos={PRODUCT_PHOTOS} />
        </section>
      )}

      {/* Klien */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <div className="border-t border-gray-100 pt-7 text-center">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-gray-400">Antara klien kami</h2>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {CLIENTS.map(c => (
              <span key={c} className="text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">{c}</span>
            ))}
            <span className="text-sm font-semibold text-gray-400 px-2 py-1">&amp; ramai lagi</span>
          </div>
        </div>
      </section>

      {/* CTA akhir */}
      <section className="max-w-5xl mx-auto px-4 pb-20 pt-2">
        <div className="rounded-2xl bg-[#1F2937] text-white px-6 py-10 text-center">
          <h3 className="text-2xl font-black">Nak kotak macam ni untuk brand anda?</h3>
          <p className="text-white/70 mt-2 text-sm max-w-xl mx-auto">Pilih saiz, pilih design atau upload artwork sendiri, isi dengan kurma pilihan — terus dapat harga.</p>
          <Link href="/kurma#kira" className="inline-flex items-center gap-1.5 mt-6 px-6 py-3.5 rounded-2xl text-white font-bold" style={{ background: '#E11D2A' }}>
            Mula reka <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  )
}
