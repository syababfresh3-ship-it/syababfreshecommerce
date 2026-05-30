import { createClient } from '@/lib/supabase/server'
import { StoreLayout } from '@/components/layout/store-layout'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  CheckCircle2, Clock, Package, Truck, XCircle,
  MapPin, CreditCard, ChevronRight, Home, ExternalLink,
} from 'lucide-react'
import { ReorderButton } from './reorder-button'
import { CancelButton } from './cancel-button'
import { BankTransferInfo } from './bank-transfer-info'
import { PurchaseTracker } from '@/components/analytics/purchase-tracker'
import { PaymentVerifier } from './payment-verifier'

// success page optimization: timeline step — used in returning (non-success) view only
function TimelineItem({
  icon: Icon,
  label,
  time,
  done,
  color,
  last = false,
}: {
  icon: any
  label: string
  time?: string | null
  done: boolean
  color: string
  last?: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
          done
            ? `bg-white border-2 border-current shadow-sm ${color}`
            : 'bg-gray-100 text-gray-300'
        }`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        {!last && (
          <div className={`w-0.5 h-7 mt-1 rounded-full ${done ? 'bg-gray-200' : 'bg-gray-100'}`} />
        )}
      </div>
      <div className="pb-1 pt-1 flex-1">
        <p className={`text-sm font-semibold ${done ? 'text-gray-900' : 'text-gray-300'}`}>{label}</p>
        {time && done ? (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(time).toLocaleString('ms-MY', {
              day: 'numeric', month: 'short',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        ) : !done ? (
          <p className="text-xs text-gray-300 mt-0.5">Menunggu</p>
        ) : null}
      </div>
    </div>
  )
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending:    { label: 'Menunggu Pengesahan', icon: Clock,         color: 'text-yellow-500' },
  confirmed:  { label: 'Pesanan Disahkan',    icon: CheckCircle2,  color: 'text-blue-500'   },
  preparing:  { label: 'Sedang Disediakan',   icon: Package,       color: 'text-purple-500' },
  delivering: { label: 'Dalam Penghantaran',  icon: Truck,         color: 'text-orange-500' },
  delivered:  { label: 'Pesanan Selesai',     icon: CheckCircle2,  color: 'text-green-500'  },
  cancelled:  { label: 'Pesanan Dibatal',     icon: XCircle,       color: 'text-red-500'    },
}

const paymentLabels: Record<string, string> = {
  fpx:           'FPX Online Banking',
  ewallet:       'E-Wallet',
  cod:           'Bayar Semasa Terima',
  bank_transfer: 'Pindahan Bank',
}

async function getOrder(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { notAuthed: true as const }

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*), confirmed_at, preparing_at, delivering_at, delivered_at, cancelled_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!data) return null

  const { data: shipment } = await supabase
    .from('order_shipments')
    .select('*, shipping_carriers(id, name)')
    .eq('order_id', id)
    .is('refund_id', null)
    .maybeSingle()

  return { ...data, shipment: shipment ?? null }
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ new?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const isNew = sp.new === '1'
  const result = await getOrder(id)
  if (!result) notFound()
  if ('notAuthed' in result) redirect(`/login?redirect=/orders/${id}${isNew ? '?new=1' : ''}`)
  const order = result

  const config = statusConfig[order.status] ?? statusConfig.pending
  const StatusIcon = config.icon

  const slotMatch = order.notes?.match(/^Slot:\s*([^|]+)/)
  const slotLabel = slotMatch ? slotMatch[1].trim() : null

  const card = 'bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] overflow-hidden'

  const isBankTransfer = order.payment_method === 'bank_transfer'
  const isUnpaidBankTransfer = isBankTransfer && order.payment_status === 'unpaid'
  const isFpxPending = isNew && ['fpx', 'ewallet', 'online'].includes(order.payment_method) && order.payment_status === 'unpaid'
  const bankProps = {
    bankName: process.env.BANK_NAME ?? 'Maybank',
    accountName: process.env.BANK_ACCOUNT_NAME ?? 'Syabab Trading Sdn Bhd',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER ?? '',
    amount: Number(order.total).toFixed(2),
    orderNumber: order.order_number,
    adminWhatsapp: process.env.ADMIN_WHATSAPP ?? '',
  }

  return (
    <StoreLayout>
      <div className="bg-gray-50 min-h-screen px-4 pt-4 pb-16 space-y-4">

        {/* ══════════════════════════════════════════════════════
            SUCCESS VIEW (isNew=true)
            ══════════════════════════════════════════════════════ */}
        {isFpxPending && <PaymentVerifier orderId={order.id} />}

        {isNew && !isBankTransfer && (
          <PurchaseTracker
            orderId={order.id}
            total={Number(order.total)}
            items={(order.order_items ?? []).map((i: any) => ({
              product_name: i.product_name,
              unit_price: Number(i.unit_price),
              quantity: i.quantity,
            }))}
          />
        )}

        {isNew ? (
          <>
            {/* ── 1. HERO ──────────────────────────────────────────
                success page optimization: green gradient hero — emotionally reassuring
                before any information is presented */}
            <div className={`relative overflow-hidden rounded-3xl px-6 pt-10 pb-9 text-center bg-gradient-to-b ${isBankTransfer ? 'from-amber-400 to-amber-500' : 'from-brand-fresh-500 to-brand-fresh-600'}`}>

              {/* Ambient decorative dots */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-5  left-7   w-2   h-2   rounded-full bg-white/20" />
                <div className="absolute top-9  right-9  w-3   h-3   rounded-full bg-white/15" />
                <div className="absolute top-4  left-1/2 w-1.5 h-1.5 rounded-full bg-white/25" />
                <div className="absolute top-14 left-4   w-1.5 h-1.5 rounded-full bg-white/20" />
                <div className="absolute top-7  right-6  w-1   h-1   rounded-full bg-white/30" />
                <div className="absolute bottom-8  left-8   w-2   h-2   rounded-full bg-white/15" />
                <div className="absolute bottom-6  right-10 w-1.5 h-1.5 rounded-full bg-white/20" />
              </div>

              {/* success page optimization: pulsing double-ring checkmark — premium and official */}
              <div className="relative mx-auto mb-5 w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-2 rounded-full bg-white/15" />
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="h-9 w-9 text-brand-fresh-500" strokeWidth={2.5} />
                </div>
              </div>

              <h1 className="text-2xl font-black text-white tracking-tight mb-2">
                {isBankTransfer ? 'Pesanan Dibuat!' : 'Pesanan Berjaya!'}
              </h1>

              <p className="text-sm font-semibold text-white leading-snug max-w-[230px] mx-auto mb-1">
                {isBankTransfer ? 'Sila buat pindahan bank sekarang ⬇️' : 'Order anda dah masuk dapur 🍓'}
              </p>
              <p className="text-xs text-white/65 mb-5 leading-relaxed max-w-[220px] mx-auto">
                {isBankTransfer ? 'Pesanan akan disahkan selepas bayaran diterima.' : 'Kami tengah siapkan buah fresh khas untuk anda.'}
              </p>

              {/* Order number chip */}
              <div className="inline-flex items-center gap-2.5 bg-white/15 backdrop-blur-sm px-4 py-2.5 rounded-2xl">
                <span className="text-[11px] text-white/65 font-medium">No. Pesanan</span>
                <span className="text-sm font-black font-mono text-white tracking-wider">
                  {order.order_number}
                </span>
              </div>
            </div>

            {/* ── 2. ORDER INFO ─────────────────────────────────────
                success page optimization: total is the dominant element — hierarchy
                drives from largest (amount) down to smallest (address) */}
            <div className={card}>

              {/* success page optimization: total hero — largest, boldest, undeniable */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-50">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  {isBankTransfer ? 'Jumlah untuk Transfer' : 'Jumlah Dibayar'}
                </p>
                <p className="text-4xl font-black text-gray-900 tabular-nums leading-none">
                  RM{Number(order.total).toFixed(2)}
                </p>
                <p className={`text-[11px] font-medium mt-2 flex items-center gap-1 ${isBankTransfer ? 'text-amber-600' : 'text-brand-fresh-600'}`}>
                  {isBankTransfer ? '⏳ Menunggu pengesahan bayaran' : '📦 Sedang disiapkan sekarang di dapur kami'}
                </p>
              </div>

              <div className="divide-y divide-gray-50">
                {/* Payment — medium emphasis */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                      <CreditCard className="h-3.5 w-3.5 text-purple-500" />
                    </div>
                    <span className="text-xs text-gray-400">Kaedah Bayaran</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {paymentLabels[order.payment_method] ?? order.payment_method}
                  </span>
                </div>

                {/* Address — smallest, most muted */}
                {order.delivery_address && (
                  <div className="flex items-start gap-2.5 px-4 py-3">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className="text-[10px] text-gray-400 mb-0.5">Alamat</p>
                      <p className="text-xs text-gray-500 leading-snug">
                        {order.delivery_address}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* success page optimization: delivery slot is 2nd most important info —
                  highlighted strongly so user immediately knows when to expect arrival */}
              {slotLabel && (
                <div className="mx-4 mb-4 mt-2 flex items-center gap-3 bg-gradient-to-r from-brand-fresh-500 to-brand-fresh-600 rounded-xl px-4 py-3.5 shadow-[0_3px_12px_rgba(34,197,94,0.25)]">
                  <Truck className="h-5 w-5 text-white shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                      Jangkaan Tiba
                    </p>
                    <p className="text-sm font-black text-white mt-0.5">
                      {slotLabel}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── 2b. BANK TRANSFER INSTRUCTIONS ───────────────────
                Only shown when payment_method is bank_transfer */}
            {isBankTransfer && (
              <BankTransferInfo {...bankProps} />
            )}

            {/* ── 3. WHAT HAPPENS NEXT ──────────────────────────────
                success page optimization: 3-step progress strip — replaces full timeline.
                Sets clear expectations without overwhelming detail. */}
            <div className={card}>
              <div className="px-4 pt-4 pb-5">
                <h2 className="text-sm font-bold text-gray-900 mb-4">Apa yang berlaku seterusnya?</h2>

                {/* success page optimization: 3-state strip — active (solid green), next (light
                    green), future (gray). Creates a sense of movement, not a static checklist. */}
                <div className="flex items-start">
                  {[
                    { label: 'Pesanan\nDisahkan',  icon: CheckCircle2, state: 'active' as const, sub: 'Dalam masa 15 min'  },
                    { label: 'Sedang\nDisediakan', icon: Package,      state: 'next'   as const, sub: 'Buah dipilih segar' },
                    { label: 'Akan\nDihantar',     icon: Truck,        state: 'future' as const, sub: 'Mengikut slot anda' },
                  ].map((step, i, arr) => (
                    <div key={i} className="flex-1 flex flex-col items-center relative">
                      {/* Connector: gradient green→gray after active, flat gray after next */}
                      {i < arr.length - 1 && (
                        <div className={`absolute top-[18px] left-1/2 w-full h-0.5 ${
                          i === 0 ? 'bg-gradient-to-r from-brand-fresh-300 to-gray-100' : 'bg-gray-100'
                        }`} />
                      )}

                      {/* Icon circle: 3 distinct states — active has pulse ring */}
                      <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center mb-2 transition-all ${
                        step.state === 'active' ? 'bg-brand-fresh-500 shadow-[0_3px_12px_rgba(34,197,94,0.40)]' :
                        step.state === 'next'   ? 'bg-brand-fresh-100' :
                                                  'bg-gray-100'
                      }`}>
                        {step.state === 'active' && (
                          <div className="absolute inset-0 rounded-full bg-brand-fresh-400 animate-ping opacity-30" style={{ animationDuration: '2.5s' }} />
                        )}
                        <step.icon className={`h-4 w-4 relative z-10 ${
                          step.state === 'active' ? 'text-white' :
                          step.state === 'next'   ? 'text-brand-fresh-500' :
                                                    'text-gray-300'
                        }`} />
                      </div>

                      <p className={`text-[10px] font-bold text-center leading-tight whitespace-pre-line ${
                        step.state === 'active' ? 'text-brand-fresh-700' :
                        step.state === 'next'   ? 'text-brand-fresh-500' :
                                                  'text-gray-300'
                      }`}>
                        {step.label}
                      </p>
                      <p className={`text-[9px] text-center mt-0.5 leading-tight ${
                        step.state === 'active' ? 'text-gray-400' :
                        step.state === 'next'   ? 'text-brand-fresh-400' :
                                                  'text-gray-200'
                      }`}>
                        {step.sub}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── 4. ORDER ITEMS ────────────────────────────────────
                success page optimization: receipt reference — user wants to verify items */}
            <div className={card}>
              <div className="px-4 py-3 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-900">Item Pesanan</h2>
              </div>
              <div className="divide-y divide-gray-50/80">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.product_image ? (
                        <Image src={item.product_image} alt={item.product_name} width={36} height={36} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-lg">🍓</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-600 flex-1 min-w-0 pr-2">
                      {item.product_name}
                      <span className="text-gray-400 ml-1">× {item.quantity}</span>
                    </span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                      RM{Number(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Penghantaran</span>
                  <span className={`tabular-nums font-medium ${Number(order.delivery_fee) === 0 ? 'text-brand-fresh-600' : 'text-gray-700'}`}>
                    {Number(order.delivery_fee) === 0 ? '✓ Percuma' : `RM${Number(order.delivery_fee).toFixed(2)}`}
                  </span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Diskaun</span>
                    <span className="text-brand-fresh-600 font-medium tabular-nums">
                      -RM{Number(order.discount).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                  <span className="text-sm font-semibold text-gray-600">Jumlah</span>
                  <span className="text-xl font-black text-gray-900 tabular-nums">
                    RM{Number(order.total).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── 5. ACTIONS ────────────────────────────────────────
                success page optimization: clear 4-tier hierarchy —
                primary → secondary → grouped conversion zone → low-priority cancel */}

            {/* PRIMARY + SECONDARY */}
            <div className="space-y-2.5 pt-1">
              <Link
                href={`/orders/${order.id}`}
                className={`w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl text-base active:scale-[0.98] transition-transform ${isBankTransfer ? 'bg-amber-500 shadow-[0_4px_16px_rgba(245,158,11,0.35)]' : 'bg-brand-fresh-500 shadow-[0_4px_16px_rgba(34,197,94,0.35)]'}`}
              >
                <Package className="h-4 w-4 opacity-80" />
                {isBankTransfer ? 'Semak Status Pesanan' : 'Jejak Pesanan Sekarang'}
                <ChevronRight className="h-4 w-4 opacity-70" />
              </Link>
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 bg-white text-gray-600 font-semibold py-3.5 rounded-2xl text-sm border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-transform"
              >
                <Home className="h-4 w-4 text-gray-400" />
                Kembali ke Home
              </Link>
            </div>

            {/* GROUPED CONVERSION ZONE: Beli Semula + repeat nudge in one visual block */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 px-4 pt-4 pb-4 space-y-4">
              <ReorderButton items={order.order_items ?? []} variant="conversion" />
              <div className="flex items-center gap-3">
                <span className="text-xl leading-none">🔄</span>
                <div>
                  <p className="text-sm font-semibold text-gray-700 leading-snug">
                    Order ni kami dah simpan
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Tekan &quot;Beli Semula&quot; bila-bila masa.
                  </p>
                </div>
              </div>
            </div>

            {/* LOW PRIORITY: cancel — quiet text link, present but not alarming */}
            {order.status === 'pending' && (
              <div className="flex justify-center">
                <CancelButton orderId={order.id} createdAt={order.created_at} compact />
              </div>
            )}
          </>
        ) : (

          /* ══════════════════════════════════════════════════════
             RETURNING VIEW (no ?new — order tracking page)
             ══════════════════════════════════════════════════════ */
          <>
            {/* Bank transfer reminder — shown when still unpaid */}
            {isUnpaidBankTransfer && (
              <BankTransferInfo {...bankProps} />
            )}

            {/* Status header */}
            <div className={`${card} p-5 text-center`}>
              <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                order.status === 'delivered' ? 'bg-green-50' :
                order.status === 'cancelled' ? 'bg-red-50' : 'bg-blue-50'
              }`}>
                <StatusIcon className={`h-6 w-6 ${config.color}`} />
              </div>
              <h1 className="text-base font-bold text-gray-900">{config.label}</h1>
              <p className="text-xs text-gray-400 mt-1 font-mono">{order.order_number}</p>
            </div>

            {/* Full status timeline */}
            <div className={card}>
              <div className="px-4 pt-4 pb-1">
                <h2 className="text-sm font-bold text-gray-900 mb-4">Status Pesanan</h2>
              </div>
              <div className="px-4 pb-4">
                {order.status === 'cancelled' || order.status === 'refunded' ? (
                  <TimelineItem
                    icon={XCircle}
                    label={order.status === 'refunded' ? 'Dibayar Balik' : 'Pesanan Dibatal'}
                    time={order.cancelled_at ?? order.created_at}
                    color="text-red-500"
                    done
                    last
                  />
                ) : (
                  <div className="space-y-0">
                    <TimelineItem icon={Clock}        label="Pesanan Dibuat"     time={order.created_at}    done                         color="text-gray-500" />
                    <TimelineItem icon={CheckCircle2} label="Pesanan Disahkan"   time={order.confirmed_at}  done={!!order.confirmed_at}  color="text-blue-500" />
                    <TimelineItem icon={Package}      label="Sedang Disediakan"  time={order.preparing_at}  done={!!order.preparing_at}  color="text-purple-500" />
                    <TimelineItem icon={Truck}        label="Dalam Penghantaran" time={order.delivering_at} done={!!order.delivering_at} color="text-orange-500" />
                    <TimelineItem icon={CheckCircle2} label="Pesanan Selesai"    time={order.delivered_at}  done={!!order.delivered_at}  color="text-green-500" last />
                  </div>
                )}
              </div>
            </div>

            {/* Tracking info — shown when tracking number or delivery link is available */}
            {((order as any).shipment?.tracking_number || (order as any).shipment?.tracking_url) && (
              <div className={card}>
                <div className="px-4 pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="h-4 w-4 text-orange-400" />
                    <h2 className="text-sm font-bold text-gray-900">Maklumat Penghantaran</h2>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Kurier</dt>
                      <dd className="font-semibold text-gray-700">
                        {(order as any).shipment.shipping_carriers?.name ?? '—'}
                      </dd>
                    </div>
                    {(order as any).shipment.tracking_number && (
                      <div className="flex justify-between items-center">
                        <dt className="text-gray-400">No. Tracking</dt>
                        <dd className="font-mono text-xs font-bold text-gray-900">
                          {(order as any).shipment.tracking_number}
                        </dd>
                      </div>
                    )}
                    {(order as any).shipment.estimated_delivery && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Anggaran Tiba</dt>
                        <dd className="text-gray-700">
                          {new Date((order as any).shipment.estimated_delivery).toLocaleDateString('ms-MY', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {(order as any).shipment.tracking_url && (
                    <a
                      href={(order as any).shipment.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 bg-orange-50 text-orange-700 font-semibold text-sm rounded-xl border border-orange-100 hover:bg-orange-100 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Jejak Penghantaran
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Order items */}
            <div className={card}>
              <div className="px-4 py-3 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-900">Item Pesanan</h2>
              </div>
              <div className="divide-y divide-gray-50/80">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-gray-600 flex-1 pr-3">
                      {item.product_name}
                      <span className="text-gray-400 ml-1">× {item.quantity}</span>
                    </span>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                      RM{Number(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Penghantaran</span>
                  <span className={`tabular-nums font-medium ${Number(order.delivery_fee) === 0 ? 'text-brand-fresh-600' : 'text-gray-700'}`}>
                    {Number(order.delivery_fee) === 0 ? '✓ Percuma' : `RM${Number(order.delivery_fee).toFixed(2)}`}
                  </span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Diskaun</span>
                    <span className="text-brand-fresh-600 font-medium tabular-nums">
                      -RM{Number(order.discount).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                  <span className="text-sm font-semibold text-gray-600">Jumlah</span>
                  <span className="text-xl font-black text-gray-900 tabular-nums">
                    RM{Number(order.total).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Address */}
            {order.delivery_address && (
              <div className={card}>
                <div className="px-4 pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <h2 className="text-sm font-bold text-gray-900">Alamat Penghantaran</h2>
                  </div>
                  <p className="text-sm text-gray-600 leading-snug">{order.delivery_address}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2.5">
              <ReorderButton items={order.order_items ?? []} />
              {order.status === 'pending' && (
                <CancelButton orderId={order.id} createdAt={order.created_at} />
              )}
            </div>

            <Link
              href="/products"
              className="flex items-center justify-center text-gray-400 text-sm py-3 font-medium"
            >
              Teruskan Beli-Belah
            </Link>
          </>
        )}
      </div>
    </StoreLayout>
  )
}
