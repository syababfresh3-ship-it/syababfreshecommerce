export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Calendar } from 'lucide-react'
import { LpOrderActions } from './lp-order-actions'
import { LpShipmentPanel } from './lp-shipment-panel'
import { LpCustomerEdit } from './lp-customer-edit'
import { ReceiptActions } from '../../receipt-actions'
import { ResellerInvoiceActions } from './reseller-invoice-actions'
import { ResellerDeliveryEdit } from './reseller-delivery-edit'

const statusCls: Record<string, string> = {
  pending:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed:  'bg-blue-50 text-blue-700 border-blue-200',
  preparing:  'bg-purple-50 text-purple-700 border-purple-200',
  delivering: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered:  'bg-green-50 text-green-700 border-green-200',
  cancelled:  'bg-red-50 text-red-600 border-red-200',
}

const payLabel: Record<string, string> = {
  fpx: 'FPX Online Banking', ewallet: 'E-Wallet', cod: 'Cash On Delivery', bank_transfer: 'Bank Transfer',
}

export default async function LpOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: order }, { data: carriers }] = await Promise.all([
    supabase.from('lp_guest_orders').select('*, landing_pages(title, slug)').eq('id', id).single(),
    supabase.from('shipping_carriers').select('id, name, is_active').eq('is_active', true).order('sort_order'),
  ])

  if (!order) notFound()

  const items: any[] = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : [{ product_name: order.product_name, variant_name: order.variant_name, quantity: order.quantity, unit_price: order.unit_price }]

  const isPaid = ['fpx', 'ewallet'].includes(order.payment_method) && order.payment_status === 'paid'
  const lpTitle = (order.landing_pages as any)?.title ?? 'LP'

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link href="/admin/orders" className="hover:text-gray-700 transition-colors">Orders</Link>
        <span>/</span>
        <span className="text-gray-600 font-medium">{order.order_number}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-gray-900 font-mono">{order.order_number}</h1>
              {order.source === 'reseller'
                ? <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Reseller</span>
                : <span className="text-xs font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">LP</span>}
              {order.delivery_method === 'pickup' && (
                <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">PICKUP</span>
              )}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border capitalize ${statusCls[order.status] ?? 'bg-gray-50 text-gray-500'}`}>
                {order.status}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {lpTitle} · {new Date(order.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        {(order.payment_status === 'paid' || (['cod', 'bank_transfer'].includes(order.payment_method) && order.status === 'delivered')) && (
          <ReceiptActions orderId={order.id} canSend={!!order.phone} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">

          {/* Customer Details (boleh edit — termasuk poskod) */}
          <LpCustomerEdit
            orderId={order.id}
            name={order.name}
            phone={order.phone}
            email={order.email ?? null}
            address={order.address ?? null}
            postcode={(order as any).postcode ?? null}
            deliveryMethod={(order as any).delivery_method ?? null}
            pickupDate={(order as any).pickup_date ?? null}
          />

          {/* Payment Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Payment Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <span className="font-medium">{payLabel[order.payment_method] ?? order.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-semibold ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                  {isPaid ? '✓ Paid' : 'Pending payment'}
                </span>
              </div>
              {order.source === 'reseller' ? (
                <ResellerDeliveryEdit orderId={order.id} deliveryFee={Number(order.delivery_fee ?? 0)} />
              ) : (
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Fee</span>
                  <span>RM{Number(order.delivery_fee ?? 0).toFixed(2)}</span>
                </div>
              )}
              {Number(order.discount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−RM{Number(order.discount).toFixed(2)}</span>
                </div>
              )}
              {Number(order.points_discount ?? 0) > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>⭐ Mata Loyalty ({order.points_used})</span>
                  <span>−RM{Number(order.points_discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-2 font-bold">
                <span>Total</span>
                <span className="text-gray-900">RM{Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Invois reseller (download + email) */}
          {order.source === 'reseller' && <ResellerInvoiceActions orderId={order.id} />}

          {/* Delivery slot / notes */}
          {order.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-600 mb-1">Customer Note</p>
              <p className="text-sm text-amber-800">{order.notes}</p>
            </div>
          )}

          {/* WA */}
          <a
            href={`https://wa.me/${order.phone.replace(/^0/, '6').replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${order.name}, regarding your order ${order.order_number} — `)}`}
            target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-2xl font-bold text-sm hover:bg-green-600 transition-colors"
          >
            💬 WhatsApp Customer
          </a>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Shipment Panel */}
          <LpShipmentPanel
            orderId={order.id}
            courierId={(order as any).courier_id ?? null}
            trackingNumber={(order as any).tracking_number ?? null}
            trackingUrl={(order as any).tracking_url ?? null}
            shipmentNotes={(order as any).shipment_notes ?? null}
            carriers={carriers ?? []}
          />

          {/* Update Status */}
          <LpOrderActions
            orderId={order.id}
            currentStatus={order.status}
            trackingUrl={(order as any).tracking_url ?? null}
          />

          {/* Items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400" />
              <h2 className="font-bold text-gray-900">Item Orders</h2>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">{item.product_name}</p>
                      {item.variant_name && <p className="text-xs text-gray-400">{item.variant_name}</p>}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">RM{Number(item.unit_price).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900">RM{(Number(item.unit_price) * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  )
}
