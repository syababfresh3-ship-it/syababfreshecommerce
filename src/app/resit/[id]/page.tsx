export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { CheckCircle2, Clock } from 'lucide-react'
import { PrintButton } from './print-button'

// Registered business details — shown on every official receipt.
const BUSINESS = {
  brand: 'SyababFresh',
  name: 'Syabab Trading Sdn Bhd',
  regNew: '202401038338',
  regOld: '1584185-T',
  tin: 'C 5955687080',
  address:
    'Lot No. 2 (Semi-D), Kompleks Premis Usahawan SME Bank Bangi, Jalan 6C/13A, Seksyen 16, Bandar Baru Bangi',
  phone: '011 9003 6446',
  email: 'syababtrading@gmail.com',
}

const paymentLabels: Record<string, string> = {
  fpx: 'FPX Online Banking',
  ewallet: 'E-Wallet',
  cod: 'Tunai (COD)',
  bank_transfer: 'Pindahan Bank',
  online: 'Online',
}

type Line = { name: string; qty: number; unitPrice: number; lineTotal: number }

type Receipt = {
  orderNumber: string
  date: string
  customerName: string
  address: string | null
  paymentMethod: string
  isPaid: boolean
  items: Line[]
  deliveryFee: number
  discount: number
  total: number
}

function isSettled(payment_status: string | null, payment_method: string | null, status: string | null) {
  if (payment_status === 'paid') return true
  // COD / bank cash is received on delivery
  return ['cod', 'bank_transfer'].includes(payment_method ?? '') && status === 'delivered'
}

async function loadReceipt(id: string): Promise<Receipt | null | 'unpaid'> {
  const supabase = createAdminClient()

  // Storefront order first
  const { data: ord } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, payment_status, payment_method, total, delivery_fee, discount, delivery_address, created_at, confirmed_at, user_id, order_items(product_name, variant_name, quantity, unit_price, subtotal)'
    )
    .eq('id', id)
    .maybeSingle()

  if (ord) {
    if (!isSettled(ord.payment_status, ord.payment_method, ord.status)) return 'unpaid'
    const { data: profile } = ord.user_id
      ? await supabase.from('profiles').select('full_name').eq('id', ord.user_id).maybeSingle()
      : { data: null }
    const items: Line[] = (ord.order_items as any[] ?? []).map((i) => {
      const qty = Number(i.quantity)
      const unitPrice = Number(i.unit_price)
      return {
        name: `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`,
        qty,
        unitPrice,
        lineTotal: i.subtotal != null ? Number(i.subtotal) : unitPrice * qty,
      }
    })
    return {
      orderNumber: ord.order_number,
      date: ord.confirmed_at ?? ord.created_at,
      customerName: (profile as any)?.full_name ?? 'Pelanggan',
      address: ord.delivery_address ?? null,
      paymentMethod: ord.payment_method,
      isPaid: true,
      items,
      deliveryFee: Number(ord.delivery_fee ?? 0),
      discount: Number(ord.discount ?? 0),
      total: Number(ord.total),
    }
  }

  // LP guest order
  const { data: lp } = await supabase
    .from('lp_guest_orders')
    .select(
      'id, order_number, name, address, status, payment_status, payment_method, total, delivery_fee, created_at, items, product_name, variant_name, quantity, unit_price'
    )
    .eq('id', id)
    .maybeSingle()

  if (lp) {
    if (!isSettled(lp.payment_status, lp.payment_method, lp.status)) return 'unpaid'
    const raw = Array.isArray(lp.items) && lp.items.length > 0
      ? (lp.items as any[])
      : [{ product_name: lp.product_name, variant_name: lp.variant_name, quantity: lp.quantity, unit_price: lp.unit_price }]
    const items: Line[] = raw.map((i) => {
      const qty = Number(i.quantity)
      const unitPrice = Number(i.unit_price)
      return {
        name: `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`,
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      }
    })
    return {
      orderNumber: lp.order_number,
      date: lp.created_at,
      customerName: lp.name ?? 'Pelanggan',
      address: lp.address ?? null,
      paymentMethod: lp.payment_method,
      isPaid: true,
      items,
      deliveryFee: Number(lp.delivery_fee ?? 0),
      discount: 0,
      total: Number(lp.total),
    }
  }

  return null
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const receipt = await loadReceipt(id)

  if (receipt === null) notFound()

  if (receipt === 'unpaid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-10 text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-6 w-6 text-amber-500" />
          </div>
          <h1 className="text-base font-bold text-gray-900">Resit belum tersedia</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Resit rasmi akan tersedia sebaik pembayaran disahkan. Sila cuba semula selepas bayaran diterima.
          </p>
        </div>
      </div>
    )
  }

  const r = receipt
  const itemsSubtotal = r.items.reduce((s, i) => s + i.lineTotal, 0)
  const dateStr = new Date(r.date).toLocaleString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 print:bg-white print:p-0">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] overflow-hidden print:shadow-none print:rounded-none">

          {/* Header — business identity */}
          <div className="px-6 pt-6 pb-5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-gray-900 tracking-tight">{BUSINESS.brand} 🌿</p>
                <p className="text-[13px] font-semibold text-gray-700 mt-1">{BUSINESS.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  No. Pendaftaran {BUSINESS.regNew} ({BUSINESS.regOld})
                </p>
                <p className="text-[11px] text-gray-400">No. TIN {BUSINESS.tin}</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 bg-green-50 text-green-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-green-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> DIBAYAR
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">{BUSINESS.address}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              {BUSINESS.phone} · {BUSINESS.email}
            </p>
          </div>

          {/* Receipt meta */}
          <div className="px-6 py-4 bg-gray-50/60 border-b border-gray-100">
            <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Resit Rasmi</p>
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="text-gray-400">No. Resit</span>
              <span className="font-bold text-gray-900 font-mono">{r.orderNumber}</span>
            </div>
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="text-gray-400">Tarikh</span>
              <span className="font-medium text-gray-700">{dateStr}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-400">Kaedah Bayaran</span>
              <span className="font-medium text-gray-700">{paymentLabels[r.paymentMethod] ?? r.paymentMethod}</span>
            </div>
          </div>

          {/* Customer */}
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pelanggan</p>
            <p className="text-sm font-semibold text-gray-900">{r.customerName}</p>
            {r.address && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{r.address}</p>}
          </div>

          {/* Items */}
          <div className="px-6 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left font-semibold py-2">Item</th>
                  <th className="text-center font-semibold py-2 w-10">Kt</th>
                  <th className="text-right font-semibold py-2 w-24">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {r.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 text-gray-700 pr-2">
                      {i.name}
                      <span className="block text-[11px] text-gray-400">RM{i.unitPrice.toFixed(2)} setiap satu</span>
                    </td>
                    <td className="py-2.5 text-center text-gray-500 tabular-nums">{i.qty}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-900 tabular-nums">RM{i.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-gray-700 tabular-nums">RM{itemsSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-400">Penghantaran</span>
              <span className="tabular-nums font-medium text-gray-700">
                {r.deliveryFee === 0 ? 'Percuma' : `RM${r.deliveryFee.toFixed(2)}`}
              </span>
            </div>
            {r.discount > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-400">Diskaun</span>
                <span className="text-brand-fresh-600 font-medium tabular-nums">-RM{r.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-gray-100">
              <span className="text-sm font-bold text-gray-900">Jumlah Dibayar</span>
              <span className="text-xl font-black text-gray-900 tabular-nums">RM{r.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Terima kasih atas pembelian anda! 🍓<br />
              Resit ini dijana komputer dan sah tanpa tandatangan.
            </p>
          </div>
        </div>

        <PrintButton />
      </div>
    </div>
  )
}
