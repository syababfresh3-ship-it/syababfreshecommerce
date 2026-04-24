import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { OrderStatusUpdater } from './order-status-updater'
import { PaymentToggle } from './payment-toggle'

async function getOrder(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select(`
      *,
      profiles(full_name, phone, email),
      order_items(*)
    `)
    .eq('id', id)
    .single()
  return data
}

const statusLabel: Record<string, string> = {
  pending:    'Menunggu',
  confirmed:  'Disahkan',
  preparing:  'Disediakan',
  delivering: 'Dihantar',
  delivered:  'Selesai',
  cancelled:  'Dibatal',
  refunded:   'Dibayar Balik',
}

const paymentMethodLabel: Record<string, string> = {
  fpx: 'FPX',
  ewallet: 'E-Wallet',
  cod: 'Bayar Semasa Terima',
  bank_transfer: 'Pindahan Bank',
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)

  if (!order) notFound()

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{order.order_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(order.created_at).toLocaleString('ms-MY')}
          </p>
        </div>
        <OrderStatusUpdater orderId={order.id} userId={order.user_id} currentStatus={order.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Maklumat Pelanggan</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Nama</dt>
              <dd className="text-gray-900 font-medium">{order.profiles?.full_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Telefon</dt>
              <dd className="text-gray-900">{order.profiles?.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{order.profiles?.email ?? '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Payment Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Maklumat Bayaran</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Kaedah</dt>
              <dd className="text-gray-900">{paymentMethodLabel[order.payment_method] ?? order.payment_method}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Status Bayaran</dt>
              <dd>
                <PaymentToggle orderId={order.id} currentStatus={order.payment_status} />
              </dd>
            </div>
            {order.payment_ref && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Ref</dt>
                <dd className="text-gray-900 font-mono text-xs">{order.payment_ref}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Delivery Address */}
      {order.delivery_address && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-2">Alamat Penghantaran</h2>
          <p className="text-sm text-gray-700">{order.delivery_address}</p>
        </div>
      )}

      {/* Order Items */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Item Pesanan</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Produk</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Harga</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Kuantiti</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {order.order_items?.map((item: any) => (
              <tr key={item.id}>
                <td className="px-5 py-3 text-gray-900">{item.product_name}</td>
                <td className="px-5 py-3 text-right text-gray-600">RM{Number(item.unit_price).toFixed(2)}</td>
                <td className="px-5 py-3 text-right text-gray-600">{item.quantity}</td>
                <td className="px-5 py-3 text-right font-medium text-gray-900">RM{Number(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>RM{Number(order.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Penghantaran</span>
            <span>{Number(order.delivery_fee) === 0 ? 'Percuma' : `RM${Number(order.delivery_fee).toFixed(2)}`}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Diskaun</span>
              <span>-RM{Number(order.discount).toFixed(2)}</span>
            </div>
          )}
          {Number(order.points_discount) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Redeem Points ({order.points_used} pts)</span>
              <span>-RM{Number(order.points_discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
            <span>Jumlah</span>
            <span>RM{Number(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-gray-700">
          <span className="font-medium">Nota pelanggan: </span>{order.notes}
        </div>
      )}
    </div>
  )
}
