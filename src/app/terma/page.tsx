import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { SfShell } from '@/components/storev2/sf-shell'

export const metadata: Metadata = {
  title: 'Terma & Syarat',
  description: 'Terma & syarat penggunaan dan pembelian di SyababFresh.',
}

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Pengenalan',
    body: 'Dengan menggunakan laman dan aplikasi SyababFresh, anda bersetuju dengan terma & syarat ini. Sila baca dengan teliti sebelum membuat pesanan.',
  },
  {
    title: '2. Pesanan & Pembayaran',
    body: 'Semua harga dalam Ringgit Malaysia (RM). Pesanan disahkan selepas pembayaran berjaya. Pembayaran dalam talian (FPX, kad, e-dompet) diproses dengan selamat melalui gateway CHIP. Pindahan bank disahkan secara manual oleh pasukan kami.',
  },
  {
    title: '3. Penghantaran',
    body: 'Lembah Klang: dalam masa 24 jam selepas pesanan disahkan. Seluruh Malaysia: 1–3 hari bekerja menggunakan kurier sejuk. Kos penghantaran dikira mengikut zon poskod dan/atau berat pesanan.',
  },
  {
    title: '4. Jaminan Kesegaran & Pemulangan',
    body: 'Kami menjamin kesegaran produk. Jika buah rosak ketika sampai, hubungi kami dengan bukti (gambar) dalam masa 24 jam — kami akan ganti produk baru atau kembalikan wang penuh.',
  },
  {
    title: '5. Syabab Points & Ganjaran',
    body: 'Syabab Points dikumpul mengikut jumlah perbelanjaan (RM) dan menentukan tier keahlian. Mata dan ganjaran tiada nilai tunai dan tidak boleh dipindah milik. Syarat tertentu mungkin dikemas kini dari masa ke masa.',
  },
  {
    title: '6. Privasi',
    body: 'Maklumat peribadi anda (nama, alamat, telefon, email) digunakan untuk memproses pesanan dan menghantar kemas kini status. Kami tidak menjual data anda kepada pihak ketiga.',
  },
  {
    title: '7. Hubungi Kami',
    body: 'Sebarang pertanyaan, sila hubungi kami melalui halaman Bantuan & Sokongan atau WhatsApp rasmi SyababFresh.',
  },
]

export default function TermaPage() {
  return (
    <SfShell>
      <div className="px-4 pt-4 pb-10 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/profile" className="h-9 w-9 grid place-items-center rounded-full -ml-1 text-gray-600 hover:bg-gray-100" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[18px] font-extrabold text-gray-900">Terma & Syarat</h1>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-[14px] font-extrabold text-gray-900 mb-1">{s.title}</h2>
              <p className="text-[13px] text-gray-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-300 mt-8">Kemas kini terakhir: Jun 2026</p>
      </div>
    </SfShell>
  )
}
