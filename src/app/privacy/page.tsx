// Polisi Privasi — halaman berasingan (keperluan merchant kad kredit).
// Dipaparkan berdiri sendiri supaya mudah dijumpai oleh pemeriksa gateway.
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { SfShell } from '@/components/storev2/sf-shell'

export const metadata: Metadata = {
  title: 'Polisi Privasi',
  description:
    'Polisi privasi SyababFresh — maklumat yang kami kumpul, cara ia digunakan, dan hak anda ke atas data peribadi.',
}

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Maklumat Yang Kami Kumpul',
    body: [
      'Kami mengumpul maklumat yang anda berikan semasa membuat pesanan atau mendaftar akaun: nama, alamat penghantaran, nombor telefon, dan alamat e-mel.',
      'Maklumat pembayaran (kad kredit/debit, FPX, e-dompet) diproses dengan selamat melalui gateway pembayaran pihak ketiga yang mematuhi piawaian. Kami TIDAK menyimpan nombor penuh kad kredit anda di pelayan kami.',
    ],
  },
  {
    title: 'Cara Maklumat Digunakan',
    body: [
      'Maklumat anda digunakan untuk memproses dan menghantar pesanan, memberi kemas kini status penghantaran, memberi sokongan pelanggan, dan (jika anda bersetuju) menghantar tawaran serta kemas kini.',
    ],
  },
  {
    title: 'Perkongsian Maklumat',
    body: [
      'Kami tidak menjual data peribadi anda kepada pihak ketiga. Maklumat hanya dikongsi dengan penyedia perkhidmatan yang perlu untuk memenuhkan pesanan anda — seperti syarikat kurier (untuk penghantaran) dan gateway pembayaran (untuk memproses bayaran).',
    ],
  },
  {
    title: 'Keselamatan Data',
    body: [
      'Kami mengambil langkah munasabah untuk melindungi maklumat anda. Sambungan ke laman ini disulitkan (HTTPS), dan akses kepada data pelanggan dihadkan kepada kakitangan yang dibenarkan sahaja.',
    ],
  },
  {
    title: 'Hak Anda',
    body: [
      'Anda berhak untuk mengakses, membetulkan, atau meminta pemadaman maklumat peribadi anda. Untuk sebarang permintaan berkaitan data, hubungi kami di syababtrading@gmail.com.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <SfShell>
      <div className="px-4 pt-4 pb-10 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/info" className="h-9 w-9 grid place-items-center rounded-full -ml-1 text-gray-600 hover:bg-gray-100" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[18px] font-extrabold text-gray-900">Polisi Privasi</h1>
        </div>

        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-[14px] font-extrabold text-gray-900 mb-1">{s.title}</h2>
              <div className="space-y-1.5">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[13px] text-gray-500 leading-relaxed">{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-gray-400 mt-6">
          Untuk terma penuh, lihat <Link href="/terma" className="underline text-gray-600">Terma &amp; Syarat</Link>.
        </p>
        <p className="text-[11px] text-gray-300 mt-6">
          Syabab Trading Sdn. Bhd. (202401038338 / 1584185-T) · Kemas kini terakhir: Julai 2026
        </p>
      </div>
    </SfShell>
  )
}
