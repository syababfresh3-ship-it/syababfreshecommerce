import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle2, FileText, Gift } from 'lucide-react'
import { LpPaymentVerifier } from '../../lp/[slug]/berjaya/lp-payment-verifier'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pesanan Berjaya — SyababFresh' }

type Props = { searchParams: Promise<{ pesanan?: string }> }

export default async function CheckoutBerjayaPage({ searchParams }: Props) {
  const { pesanan } = await searchParams
  const supabase = createAdminClient()

  const order = pesanan ? await supabase
    .from('lp_guest_orders')
    .select('id, status, order_number, name, phone, total, delivery_fee, payment_method, items, product_name, variant_name, quantity, unit_price')
    .eq('order_number', pesanan)
    .single()
    .then(r => r.data) : null

  const items: any[] = Array.isArray(order?.items) && order.items.length > 0
    ? order.items
    : order ? [{ product_name: order.product_name, variant_name: order.variant_name, quantity: order.quantity, unit_price: order.unit_price }]
    : []

  const isOnline = order ? ['fpx', 'ewallet'].includes(order.payment_method) : false

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sahkan bayaran FPX terus dengan CHIP jika webhook belum sampai */}
      {order && order.status === 'pending' && isOnline && <LpPaymentVerifier orderId={order.id} />}

      <header className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between max-w-md mx-auto">
        <Link href="/" className="font-black text-lg text-brand-fresh-600">SyababFresh</Link>
        <Link href="/products" className="text-[13px] text-gray-500">← Beli-belah</Link>
      </header>

      <div className="max-w-md mx-auto px-5 pt-8 pb-20">
        <div className="rounded-3xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.10)] mb-5">
          {/* Hero */}
          <div className="bg-gradient-to-br from-brand-fresh-500 to-brand-fresh-600 px-6 py-9 text-center">
            <div className="w-[72px] h-[72px] rounded-full bg-white/15 border-[3px] border-white/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-9 w-9 text-white" />
            </div>
            <p className="text-2xl font-black text-white mb-1.5">
              {isOnline ? 'Pembayaran Berjaya!' : 'Pesanan Diterima!'}
            </p>
            <p className="text-sm text-white/75">
              {isOnline ? 'Bayaran anda telah diterima & disahkan' : 'Pesanan anda sedang diproses'}
            </p>
          </div>

          <div className="bg-white px-5 py-6">
            {order ? (
              <>
                <div className="bg-brand-fresh-50 rounded-2xl p-4 mb-4">
                  <div className="flex justify-between text-[13px] mb-2 text-gray-500">
                    <span>No. Pesanan</span>
                    <span className="font-black font-mono text-brand-fresh-700">{order.order_number}</span>
                  </div>
                  <div className="flex justify-between text-[13px] mb-2 text-gray-500">
                    <span>Nama</span><span className="font-bold text-gray-900">{order.name}</span>
                  </div>
                  <div className="flex justify-between text-[13px] mb-2 text-gray-500">
                    <span>No. Telefon</span><span className="font-bold text-gray-900">{order.phone}</span>
                  </div>
                  <div className="border-t border-brand-fresh-200 pt-2.5 mt-1">
                    {items.map((item: any, i: number) => (
                      <div key={i} className={`flex justify-between text-[13px] ${i < items.length - 1 ? 'mb-1.5' : ''}`}>
                        <span className="text-gray-700">{item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ''} × {item.quantity}</span>
                        <span className="font-bold text-gray-900">RM{(Number(item.unit_price) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {Number(order.delivery_fee) > 0 && (
                    <div className="flex justify-between text-[13px] mt-1.5 text-gray-500">
                      <span>Penghantaran</span><span className="font-semibold">RM{Number(order.delivery_fee).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-brand-fresh-200 pt-2.5 mt-2.5 font-black text-[17px]">
                    <span>Jumlah</span><span className="text-brand-fresh-700">RM{Number(order.total).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-green-50 rounded-xl px-4 py-3.5 mb-4 text-[13px] text-green-800">
                  <p className="font-extrabold mb-1.5">Apa seterusnya?</p>
                  <p className="leading-relaxed">Pesanan anda sedang diproses & akan dihantar mengikut jadual. Kami akan hubungi anda untuk update penghantaran.</p>
                </div>

                <a href={`/resit/${order.id}`}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-brand-fresh-600 text-white rounded-2xl font-bold text-sm mb-2.5">
                  <FileText className="h-4 w-4" /> Lihat / Muat Turun Resit
                </a>

                {/* Daftar/login → kumpul points + track order (link ikut phone/email) */}
                <Link href="/daftar"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-brand-yellow-500 text-white rounded-2xl font-bold text-sm">
                  <Gift className="h-4 w-4" /> Daftar / Log Masuk — Kumpul Points & Track Order
                </Link>
              </>
            ) : (
              <div className="text-center py-5 text-gray-500 text-sm">
                <p className="text-4xl mb-3">🎉</p>
                <p>Pesanan anda telah diterima. Team kami akan menghubungi anda tidak lama lagi.</p>
              </div>
            )}
          </div>
        </div>

        <Link href="/products" className="block text-center text-sm text-gray-400 py-3">
          ← Kembali beli-belah
        </Link>
      </div>
    </div>
  )
}
