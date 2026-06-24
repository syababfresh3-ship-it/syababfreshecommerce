export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { OrderStatusUpdater } from './order-status-updater'
import { PaymentToggle } from './payment-toggle'
import { RefundButton } from './refund-button'
import { ShipmentPanel } from './shipment-panel'
import { ReceiptActions } from '../receipt-actions'
import { InvoiceActions } from './invoice-actions'

async function getOrder(id: string) {
  const supabase = createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single()
  if (!order) return null

  const [{ data: profile }, { data: shipment }, { data: carriers }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, email').eq('id', order.user_id).single(),
    supabase.from('order_shipments').select('*, shipping_carriers(*)').eq('order_id', id).is('refund_id', null).maybeSingle(),
    supabase.from('shipping_carriers').select('*').eq('is_active', true).order('sort_order'),
  ])

  return { ...order, profiles: profile ?? null, shipment: shipment ?? null, carriers: carriers ?? [] }
}

const statusLabel: Record<string, string> = {
  pending:    'Pending',
  confirmed:  'Confirmed',
  preparing:  'Preparing',
  delivering: 'Shipped',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
  refunded:   'Refunded',
}

const paymentMethodLabel: Record<string, string> = {
  fpx: 'FPX',
  ewallet: 'E-Wallet',
  cod: 'Cash On Delivery',
  bank_transfer: 'Pindahan Bank',
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)

  if (!order) notFound()

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{order.order_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(order.created_at).toLocaleString('en-MY')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(order.payment_status === 'paid' || (['cod', 'bank_transfer'].includes(order.payment_method) && order.status === 'delivered')) && (
            <ReceiptActions orderId={order.id} canSend={!!order.profiles?.phone} />
          )}
          <InvoiceActions orderId={order.id} canEmail={!!order.profiles?.email} />
          {order.payment_status === 'paid' && order.status !== 'refunded' && (
            <RefundButton orderId={order.id} amount={order.total} />
          )}
          <Link href={`/admin/refunds/new?orderId=${order.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
            Refund Terperinci
          </Link>
          <OrderStatusUpdater orderId={order.id} userId={order.user_id} currentStatus={order.status} deliveryMethod={order.delivery_method} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Customer Details</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-900 font-medium">{order.profiles?.full_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
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
          <h2 className="font-semibold text-gray-900 mb-3">Payment Details</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Kaedah</dt>
              <dd className="text-gray-900">{paymentMethodLabel[order.payment_method] ?? order.payment_method}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Status Payment</dt>
              <dd>
                <PaymentToggle
                  orderId={order.id}
                  currentStatus={order.payment_status}
                  paymentMethod={order.payment_method}
                  currentRef={order.payment_ref}
                />
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

      {/* Delivery Address + Slot / Pickup */}
      {(order.delivery_address || order.delivery_slot || order.delivery_method === 'pickup') && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-semibold text-gray-900">{order.delivery_method === 'pickup' ? 'Ambil Sendiri (Pickup)' : 'Pengsendan'}</h2>
            {order.delivery_method === 'pickup' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">PICKUP</span>
            )}
          </div>
          {order.delivery_method === 'pickup' && order.pickup_date && (
            <p className="text-sm text-brand-fresh-700 font-semibold mb-1.5">📅 Tarikh ambil: {new Date(order.pickup_date).toLocaleDateString('en-MY')}</p>
          )}
          {order.delivery_slot && (
            <p className="text-sm text-brand-fresh-700 font-semibold mb-1.5">🕐 {order.delivery_slot}</p>
          )}
          {order.delivery_address && (
            <p className="text-sm text-gray-700 whitespace-pre-line">{order.delivery_address}</p>
          )}
          {order.postcode && (
            <p className="text-sm text-gray-500 mt-1">Poskod: <span className="font-semibold text-gray-800">{order.postcode}</span></p>
          )}
        </div>
      )}

      {/* Shipment panel */}
      <ShipmentPanel
        orderId={order.id}
        initialShipment={(order as any).shipment}
        carriers={(order as any).carriers}
      />

      {/* Order Items */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Item Orders</h2>
        </div>

        {/* Mobile list */}
        <div className="sm:hidden divide-y divide-gray-50">
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium">{item.product_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  RM{Number(item.unit_price).toFixed(2)} × {item.quantity}
                </p>
              </div>
              <span className="font-semibold text-gray-900 shrink-0">RM{Number(item.subtotal).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <table className="hidden sm:table w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Product</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">Price</th>
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
            <span>Pengsendan</span>
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
            <span>Total</span>
            <span>RM{Number(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-gray-700">
          <span className="font-medium">Customer note: </span>{order.notes}
        </div>
      )}
    </div>
  )
}
