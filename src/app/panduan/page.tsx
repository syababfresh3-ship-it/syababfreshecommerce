// Indeks panduan & FAQ — senarai semua artikel (SEO Fasa 3).
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { SfShell } from '@/components/storev2/sf-shell'
import { ARTIKEL } from './artikel'

export const metadata: Metadata = {
  title: 'Panduan & Tips Buah',
  description:
    'Panduan buah segar dari SyababFresh — cara pilih, simpan dan nikmati buah bermusim seperti ceri Turki dan mangga Harumanis, serta FAQ penghantaran.',
}

export default function PanduanIndexPage() {
  return (
    <SfShell>
      <div className="px-4 pt-4 pb-10 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/" className="h-9 w-9 grid place-items-center rounded-full -ml-1 text-gray-600 hover:bg-gray-100" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[18px] font-extrabold text-gray-900">Panduan & Tips Buah</h1>
        </div>
        <p className="text-[13px] text-gray-500 mb-5 ml-1">
          Cara pilih, simpan dan nikmati buah segar — ditulis oleh team SyababFresh.
        </p>

        <div className="space-y-3">
          {/* Pautan MASUK ke pillar page — kuatkan kluster "buah online". */}
          <Link
            href="/buah-online"
            className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-4 shadow-sm hover:border-red-200 transition-colors"
          >
            <div className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-red-600 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-extrabold text-gray-900 leading-snug">Panduan lengkap beli buah online</div>
              <div className="text-[12px] text-gray-500 line-clamp-2 mt-0.5">Apa perlu diperiksa sebelum pesan, cara buah dihantar, dan cara pilih ikut keperluan.</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
          </Link>

          {ARTIKEL.map((a) => (
            <Link
              key={a.slug}
              href={`/panduan/${a.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:border-red-200 transition-colors"
            >
              <div className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-red-50 text-red-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold text-gray-900 leading-snug">{a.title}</div>
                <div className="text-[12px] text-gray-500 line-clamp-2 mt-0.5">{a.description}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>
      </div>
    </SfShell>
  )
}
