import type { Metadata } from 'next'
import { StoreLayout } from '@/components/layout/store-layout'

export const metadata: Metadata = {
  title: 'FAQ & Maklumat',
  description: 'Soalan lazim tentang penghantaran, kawasan liputan, jaminan kesegaran, dan cara order buah segar SyababFresh.',
}
import { Truck, Clock, MapPin, Phone, RotateCcw, CreditCard, ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'Berapa lama masa penghantaran?',
    a: 'Kami menghantar dalam masa 24 jam untuk kawasan Klang Valley. Untuk kawasan lain, sila hubungi kami terlebih dahulu.',
  },
  {
    q: 'Adakah penghantaran percuma?',
    a: 'Ya! Penghantaran percuma untuk pesanan melebihi RM80. Bawah RM80, caj penghantaran adalah RM8 sahaja.',
  },
  {
    q: 'Apa kawasan yang diliputi?',
    a: 'Kami meliputi seluruh Klang Valley termasuk KL, Petaling Jaya, Subang Jaya, Shah Alam, Klang, Cheras, Ampang, Puchong, dan kawasan sekitar.',
  },
  {
    q: 'Bagaimana jika buah tidak segar?',
    a: 'Kami menawarkan Jaminan Kesegaran 100%. Jika produk tidak segar, kami akan gantikan dengan produk baru atau pulangkan wang penuh. Tiada soal jawab!',
  },
  {
    q: 'Boleh saya tukar atau batalkan pesanan?',
    a: 'Pesanan boleh dibatalkan dalam masa 30 minit selepas dibuat. Selepas itu, kami mungkin sudah mula menyediakan pesanan anda. Hubungi kami segera jika perlu.',
  },
  {
    q: 'Kaedah bayaran apa yang diterima?',
    a: 'Kami menerima FPX Online Banking, E-Wallet (Touch\'n Go / Boost), bayar semasa terima (COD), dan pindahan bank.',
  },
  {
    q: 'Boleh saya buat pesanan bulk atau borong?',
    a: 'Ya! Untuk pesanan borong atau kuantiti besar, sila hubungi kami terus melalui WhatsApp untuk harga khas.',
  },
  {
    q: 'Macam mana nak guna Loyalty Points?',
    a: 'Setiap RM1 belanja = 1 mata. Tukaran: 100 mata = RM1 diskaun. Aktifkan toggle "Guna Mata" semasa checkout.',
  },
]

const deliverySlots = [
  { time: '10am – 2pm', note: 'Order sebelum 8am' },
  { time: '2pm – 6pm', note: 'Order sebelum 12pm' },
  { time: '6pm – 9pm', note: 'Order sebelum 4pm' },
]

export default function InfoPage() {
  return (
    <StoreLayout>
      <div className="px-4 pt-4 pb-8 space-y-5">
        <h1 className="text-lg font-bold text-gray-900">Maklumat & Soalan Lazim</h1>

        {/* Delivery info */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-brand-red-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Penghantaran</h2>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-700">Kawasan Liputan</p>
                <p className="text-xs text-gray-500">Klang Valley — KL, PJ, Subang, Shah Alam, Klang, Cheras, Puchong & sekitar</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-700">Masa Penghantaran</p>
                <p className="text-xs text-gray-500">24 jam selepas pengesahan pesanan</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CreditCard className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-700">Caj Penghantaran</p>
                <p className="text-xs text-gray-500">Percuma untuk pesanan ≥ RM80 · RM8 untuk pesanan di bawah RM80</p>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery slots */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-brand-red-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Slot Penghantaran (Setiap Hari)</h2>
          </div>
          <div className="space-y-2">
            {deliverySlots.map((slot) => (
              <div key={slot.time} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-900">{slot.time}</span>
                <span className="text-xs text-gray-400">{slot.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Freshness guarantee */}
        <div className="bg-brand-red-50 border border-brand-red-200 rounded-xl p-4 flex gap-3">
          <RotateCcw className="h-5 w-5 text-brand-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-gray-900">Jaminan Kesegaran 100%</p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Tidak berpuas hati dengan kesegaran produk? Kami akan ganti produk baru atau pulangkan wang penuh.
              Tanpa soal jawab. Hubungi kami dalam masa 24 jam selepas terima.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Phone className="h-4 w-4 text-brand-red-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Hubungi Kami</h2>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              <span className="font-medium">WhatsApp:</span>{' '}
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? ''}`}
                className="text-brand-red-600 hover:underline"
              >
                {process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT
                  ? `+${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}`
                  : 'Lihat di bawah'}
              </a>
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-medium">Waktu Operasi:</span> Isnin–Ahad, 8am–9pm
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          <div className="px-4 py-3">
            <h2 className="font-semibold text-gray-900 text-sm">Soalan Lazim (FAQ)</h2>
          </div>
          {faqs.map((faq, i) => (
            <details key={i} className="group px-4">
              <summary className="flex items-center justify-between py-3 text-sm font-medium text-gray-800 cursor-pointer list-none">
                {faq.q}
                <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform shrink-0 ml-2" />
              </summary>
              <p className="pb-3 text-xs text-gray-500 leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </StoreLayout>
  )
}
