// Polisi Pemulangan / Refund — halaman berasingan (keperluan merchant kad kredit).
// Kandungan selari dengan /terma seksyen 4, dipaparkan berdiri sendiri supaya
// mudah dijumpai oleh pemeriksa gateway pembayaran.
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { SfShell } from '@/components/storev2/sf-shell'

export const metadata: Metadata = {
  title: 'Polisi Pemulangan & Bayaran Balik',
  description:
    'Polisi pemulangan dan bayaran balik SyababFresh — jaminan kesegaran, cara membuat tuntutan, dan tempoh bayaran balik.',
}

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Jaminan Kesegaran',
    body: [
      'SyababFresh menjamin kesegaran setiap produk. Jika buah sampai dalam keadaan rosak, reput, atau tidak memuaskan, anda layak untuk penggantian atau bayaran balik penuh.',
    ],
  },
  {
    title: 'Cara Membuat Tuntutan',
    body: [
      'Ambil gambar produk dan bungkusan sebagai bukti, dan hubungi kami dalam masa 24 jam selepas menerima pesanan.',
      'Hubungi melalui e-mel syababtrading@gmail.com, WhatsApp rasmi, atau halaman Bantuan & Sokongan. Sertakan nombor pesanan anda.',
    ],
  },
  {
    title: 'Penyelesaian',
    body: [
      'Setelah tuntutan disahkan, kami akan menghantar produk gantian baharu, ATAU memulangkan wang penuh mengikut pilihan anda.',
      'Bayaran balik untuk pembayaran kad kredit/debit dan pembayaran dalam talian akan dikreditkan semula ke kaedah pembayaran asal. Tempoh pemprosesan lazimnya 7 hingga 14 hari bekerja bergantung pada bank pengeluar kad.',
    ],
  },
  {
    title: 'Pembatalan Pesanan',
    body: [
      'Pesanan boleh dibatalkan dalam masa 30 minit selepas dibuat, selagi ia belum mula disediakan. Selepas pesanan mula disediakan, pembatalan mungkin tidak dapat dilakukan. Sila hubungi kami segera jika perlu.',
    ],
  },
  {
    title: 'Pengecualian',
    body: [
      'Tuntutan yang dibuat melebihi 24 jam selepas penerimaan, atau tanpa bukti gambar, mungkin tidak dapat diproses. Kerosakan akibat penyimpanan yang tidak betul selepas penghantaran diterima adalah di luar jaminan ini.',
    ],
  },
]

export default function RefundPage() {
  return (
    <SfShell>
      <div className="px-4 pt-4 pb-10 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/info" className="h-9 w-9 grid place-items-center rounded-full -ml-1 text-gray-600 hover:bg-gray-100" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[18px] font-extrabold text-gray-900">Polisi Pemulangan &amp; Bayaran Balik</h1>
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
