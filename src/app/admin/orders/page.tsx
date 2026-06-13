export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Suspense } from 'react'
import { OrderFilters } from './order-filters'
import { OrdersTableClient } from './orders-table-client'
import { Download, Zap, Package, Truck, Tag } from 'lucide-react'
import { LpOrdersSection } from './lp-orders-section'
import type { Order } from '@/types'

type OrderWithProfile = Order & { profiles: { full_name: string; phone: string } | null }

const statusConfig: Record<string, { label: string }> = {
  pending:    { label: 'Pending' },
  confirmed:  { label: 'Confirmed' },
  preparing:  { label: 'Preparing' },
  delivering: { label: 'Delivering' },
  delivered:  { label: 'Delivered' },
  cancelled:  { label: 'Cancelled' },
  refunded:   { label: 'Refunded' },
}

// Urgency level — lower = more urgent
function urgency(order: OrderWithProfile): number {
  const method = (order as any).payment_method
  if (order.status === 'pending' && (order.payment_status === 'paid' || method === 'cod' || method === 'bank_transfer')) return 0
  if (order.status === 'confirmed') return 1
  if (order.status === 'preparing') return 2
  if (order.status === 'pending' && order.payment_status === 'unpaid') return 3
  if (order.status === 'delivering') return 4
  if (order.status === 'delivered') return 5
  return 6
}


function dateRange(preset?: string): { gte?: string; lt?: string } {
  if (!preset) return {}
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === 'hari-ini') {
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    return { gte: today.toISOString(), lt: tomorrow.toISOString() }
  }
  if (preset === 'semalam') {
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    return { gte: yesterday.toISOString(), lt: today.toISOString() }
  }
  if (preset === '7-hari') {
    const week = new Date(today); week.setDate(today.getDate() - 6)
    return { gte: week.toISOString() }
  }
  if (preset === 'bulan-ini') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return { gte: monthStart.toISOString() }
  }
  return {}
}

type Bounds = { gte?: string; lt?: string; lte?: string }

async function getOrders(status: string | undefined, q: string | undefined, bounds: Bounds) {
  const supabase = createAdminClient()
  // Ambil SEMUA storefront order yang sepadan, paging melepasi cap 1000-baris PostgREST.
  // (Dulu had tetap 500 menyorok order lama secara senyap.) Display paging dibuat
  // client-side dalam OrdersTableClient.
  const CHUNK = 1000
  const orders: any[] = []
  for (let from = 0; ; from += CHUNK) {
    let query = supabase
      .from('orders')
      .select('id, order_number, status, total, payment_status, payment_method, delivery_slot, delivery_method, created_at, user_id')
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK - 1)

    if (status) query = query.eq('status', status)
    if (bounds.gte) query = query.gte('created_at', bounds.gte)
    if (bounds.lt)  query = query.lt('created_at', bounds.lt)
    if (bounds.lte) query = query.lte('created_at', bounds.lte)

    const { data, error } = await query
    if (error || !data || data.length === 0) break
    orders.push(...data)
    if (data.length < CHUNK) break
  }
  if (orders.length === 0) return []

  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds)

  const profileMap: Record<string, { full_name: string; phone: string }> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p

  let enriched: OrderWithProfile[] = (orders as any[]).map((o) => ({
    ...o,
    profiles: profileMap[o.user_id] ?? null,
  }))

  if (q) {
    const lower = q.toLowerCase()
    enriched = enriched.filter((o) =>
      o.order_number?.toLowerCase().includes(lower) ||
      o.profiles?.full_name?.toLowerCase().includes(lower) ||
      o.profiles?.phone?.includes(q)
    )
  }

  // Sort by urgency, then by time (newest first within same urgency)
  enriched.sort((a, b) => {
    const ua = urgency(a), ub = urgency(b)
    if (ua !== ub) return ua - ub
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return enriched
}

async function getStatusCounts() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('orders')
    .select('status, payment_status, payment_method')
    .not('status', 'in', '(delivered,cancelled,refunded)')

  if (!data) return { needAction: 0, confirmed: 0, preparing: 0, delivering: 0 }

  const needAction = data.filter(o =>
    o.status === 'pending' && (o.payment_status === 'paid' || o.payment_method === 'cod' || o.payment_method === 'bank_transfer')
  ).length
  const confirmed  = data.filter(o => o.status === 'confirmed').length
  const preparing  = data.filter(o => o.status === 'preparing').length
  const delivering = data.filter(o => o.status === 'delivering').length

  return { needAction, confirmed, preparing, delivering }
}

const LP_SELECT =
  'id, order_number, name, phone, address, postcode, notes, status, payment_status, total, payment_method, delivery_fee, delivery_method, created_at, items, product_name, variant_name, quantity, unit_price, page_id, source, landing_pages(title, slug)'

// Fetch ALL matching LP orders, paging past PostgREST's 1000-row-per-request cap.
// At ~90 orders/day a fixed limit silently hides older paid orders within weeks,
// so we loop .range() until a short page signals the end. Display paging is done
// client-side in OrdersTableClient.
// pageId set = ditapis ke satu LP (mod attribution) → tunjuk SEMUA status (termasuk
// delivered) supaya kiraan sales penuh. Tanpa pageId, delivered TETAP tunjuk (untuk
// semakan semula + kira-kira team sales) — hanya cancelled/refunded disorok.
async function getAllLpOrders(status: string | undefined, bounds: Bounds, pageId?: string) {
  const supabase = createAdminClient()
  const { gte, lt, lte } = bounds
  const CHUNK = 1000
  const all: any[] = []
  for (let from = 0; ; from += CHUNK) {
    let q = supabase
      .from('lp_guest_orders')
      .select(LP_SELECT)
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK - 1)
    if (status) q = q.eq('status', status)
    else if (!pageId) q = q.not('status', 'in', '(cancelled,refunded)')
    if (pageId) q = q.eq('page_id', pageId)
    if (gte) q = q.gte('created_at', gte)
    if (lt) q = q.lt('created_at', lt)
    if (lte) q = q.lte('created_at', lte)
    const { data, error } = await q
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < CHUNK) break
  }
  return all
}

// Senarai LP untuk dropdown tapisan
async function getLandingPages() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('landing_pages')
    .select('id, title, slug')
    .order('created_at', { ascending: false })
  return (data ?? []) as { id: string; title: string; slug: string }[]
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; date?: string; lp?: string; from?: string; to?: string; pay?: string; staff?: string }>
}) {
  const { status, q, date, lp, from, to, pay, staff } = await searchParams

  // Tarikh: julat custom (from/to, MYT) mengatasi preset. 'to' inklusif (lte 23:59:59).
  const bounds: Bounds = (from || to)
    ? {
        ...(from ? { gte: `${from}T00:00:00+08:00` } : {}),
        ...(to ? { lte: `${to}T23:59:59+08:00` } : {}),
      }
    : dateRange(date)

  // Sumber: 'storefront' = kedai sahaja; UUID = LP tertentu sahaja (kedai tiada attribution); else dua-dua.
  const manualOnly = lp === 'manual'
  const storefrontOnly = lp === 'storefront'
  const lpPageId = lp && lp !== 'storefront' && lp !== 'manual' ? lp : undefined
  const lpSpecific = !!lpPageId

  const [orders, counts, lpRows, landingPages] = await Promise.all([
    lpSpecific ? Promise.resolve([] as Awaited<ReturnType<typeof getOrders>>) : getOrders(status, q, bounds),
    getStatusCounts(),
    storefrontOnly ? Promise.resolve([] as any[]) : getAllLpOrders(status, bounds, lpPageId),
    getLandingPages(),
  ])
  // Hide unpaid online (FPX/e-wallet) orders — customer opened the payment page but
  // never paid. COD/bank orders always show (no online payment to wait for).
  // 'refunded' = dah dibayar dahulu kemudian dipulangkan → kekal papar (admin rujuk
  // balik). Polisi sama untuk storefront & LP.
  const isPaidOrOffline = (o: any) =>
    ['fpx', 'ewallet'].includes(o.payment_method) ? ['paid', 'refunded'].includes(o.payment_status) : true
  const visibleOrders = orders.filter(isPaidOrOffline)
  let allLpOrders = lpRows.filter(isPaidOrOffline)
  // Search filter — match order number, customer name, or phone
  if (q) {
    const lower = q.toLowerCase()
    allLpOrders = allLpOrders.filter((o: any) =>
      o.order_number?.toLowerCase().includes(lower) ||
      o.name?.toLowerCase().includes(lower) ||
      o.phone?.includes(q)
    )
  }
  const lpOrders = allLpOrders.filter((o: any) => o.status === 'pending')

  // Transform LP orders to match Order shape for the table.
  // Order Quick Order (source='whatsapp'/'manual') = order MANUAL, bukan LP sebenar →
  // badge 'Manual' + jangan tunjuk tajuk LP (kekal _isLp untuk routing/PATCH endpoint LP).
  const lpAsOrders = allLpOrders.map((lp: any) => {
    // Quick Order hantar source 'whatsapp' atau 'whatsapp-<staff>' → guna startsWith
    const isReseller = lp.source === 'reseller'
    const isStoreGuest = lp.source === 'store-guest'
    const isManual = !isReseller && !isStoreGuest && typeof lp.source === 'string' && (lp.source.startsWith('whatsapp') || lp.source === 'manual')
    // Nama staf disimpan dalam source sbg 'whatsapp-<nama>' (Quick Order)
    const staffName = isManual && typeof lp.source === 'string' && lp.source.startsWith('whatsapp-')
      ? lp.source.slice('whatsapp-'.length) : null
    return ({
    id: lp.id,
    order_number: lp.order_number,
    status: lp.status,
    total: lp.total,
    payment_method: lp.payment_method,
    payment_status: lp.payment_status ?? 'unpaid',
    created_at: lp.created_at,
    delivery_slot: null,
    delivery_method: lp.delivery_method,
    needs_approval: false,
    user_id: null,
    profiles: { full_name: lp.name, phone: lp.phone },
    order_items: (Array.isArray(lp.items) && lp.items.length > 0
      ? lp.items
      : [{ product_name: lp.product_name, variant_name: lp.variant_name, quantity: lp.quantity }]
    ).map((i: any) => ({
      product_name: `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`,
      quantity: i.quantity,
    })),
    _isLp: true,
    _isManual: isManual,
    _staff: staffName,
    _isReseller: isReseller,
    _isStoreGuest: isStoreGuest,
    _lpTitle: (isManual || isReseller || isStoreGuest) ? null : (Array.isArray(lp.landing_pages) ? lp.landing_pages[0]?.title : lp.landing_pages?.title),
  })
  })

  // Merge and sort by created_at desc
  let mergedOrders = [...visibleOrders, ...lpAsOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Senarai staf untuk dropdown filter (nama tetap + apa yg ada dalam data)
  const staffList = [...new Set([
    'Muhd', 'Man', 'Pika', 'Far',
    ...allLpOrders
      .filter((o: any) => typeof o.source === 'string' && o.source.startsWith('whatsapp-'))
      .map((o: any) => o.source.slice('whatsapp-'.length))
      .filter(Boolean),
  ])].sort()

  // Tapis "Keyin Manual" (lp=manual) & ikut staf
  if (manualOnly) mergedOrders = mergedOrders.filter((o: any) => o._isManual)
  if (staff) mergedOrders = mergedOrders.filter((o: any) => o._staff === staff)

  // Tapisan pembayaran (pay=unpaid|paid). Online belum-bayar dah disorok di atas,
  // jadi 'unpaid' di sini = COD/bank transfer yang belum dikutip.
  const allOrders = pay === 'unpaid'
    ? mergedOrders.filter((o: any) => o.payment_status === 'unpaid')
    : pay === 'paid'
    ? mergedOrders.filter((o: any) => o.payment_status === 'paid')
    : mergedOrders

  // Ringkasan header (ikut tapisan semasa)
  const totalRm = allOrders.reduce((s, o) => s + Number((o as any).total || 0), 0)
  const lpLabel = lpSpecific
    ? (landingPages.find((p) => p.id === lpPageId)?.title ?? 'LP')
    : storefrontOnly ? 'Storefront sahaja' : null
  const presetLabel = date
    ? (date === 'hari-ini' ? 'Today' : date === 'semalam' ? 'Yesterday' : date === '7-hari' ? 'Last 7 Days' : 'This Month')
    : null
  const rangeLabel = (from || to) ? `${from ?? '…'} – ${to ?? '…'}` : presetLabel

  const summaryItems = [
    { icon: Zap,          label: 'Perlu Confirm', count: counts.needAction, color: 'text-red-600 bg-red-50 border-red-200',      status: 'pending' },
    { icon: Package,      label: 'Confirmed',     count: counts.confirmed,  color: 'text-blue-600 bg-blue-50 border-blue-200',    status: 'confirmed' },
    { icon: Package,      label: 'Preparing',   count: counts.preparing,  color: 'text-purple-600 bg-purple-50 border-purple-200', status: 'preparing' },
    { icon: Truck,        label: 'Delivering',     count: counts.delivering, color: 'text-orange-600 bg-orange-50 border-orange-200', status: 'delivering' },
  ].filter(s => s.count > 0)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="font-semibold text-gray-600">{allOrders.length}</span> records
            <span className="text-gray-300"> · </span>
            <span className="font-semibold text-gray-600">RM{totalRm.toFixed(2)}</span>
            {status ? <span className="text-gray-300"> · </span> : ''}
            {status ? <span className="text-gray-500">{statusConfig[status]?.label ?? status}</span> : ''}
            {lpLabel ? <span className="text-gray-300"> · </span> : ''}
            {lpLabel ? <span className="text-rose-500 font-medium">{lpLabel}</span> : ''}
            {rangeLabel ? <span className="text-gray-300"> · </span> : ''}
            {rangeLabel ? <span className="text-blue-500 font-medium">{rangeLabel}</span> : ''}
          </p>
        </div>
        <a
          href="/api/admin/export-orders"
          download
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3.5 py-2 rounded-xl hover:bg-gray-50 shadow-sm transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
        </a>
      </div>

      {/* Summary strip — shows what needs attention */}
      {summaryItems.length > 0 && (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4">
          {summaryItems.map((s) => (
            <Link
              key={s.status}
              href={`/admin/orders?status=${s.status}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all hover:shadow-md hover:-translate-y-0.5 ${s.color}`}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <div>
                <div className="text-base font-black leading-none">{s.count}</div>
                <div className="font-medium opacity-80 leading-tight mt-0.5">{s.label}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* LP Orders section */}
      {lpOrders.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-rose-600 shadow-sm mb-3">
            <Tag className="h-4 w-4 text-white" />
            <span className="text-sm font-bold text-white flex-1">New LP Orders — Awaiting Confirmation</span>
            <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">{lpOrders.length}</span>
          </div>
          <LpOrdersSection lpOrders={lpOrders.map((o: any) => ({ ...o, landing_pages: Array.isArray(o.landing_pages) ? o.landing_pages[0] ?? null : o.landing_pages }))} />
        </div>
      )}

      <Suspense><OrderFilters activeStatus={status} activeSearch={q} activeDate={date} activeLp={lp} activeFrom={from} activeTo={to} activePay={pay} activeStaff={staff} landingPages={landingPages} staffList={staffList} /></Suspense>

      <OrdersTableClient orders={allOrders as any} searchQuery={q} />

      {/* Flow guide */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2.5">Order Flow</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Pending',   color: 'bg-yellow-400', hint: 'Awaiting payment' },
            { label: 'Confirmed',   color: 'bg-blue-400',   hint: 'Start preparing' },
            { label: 'Preparing', color: 'bg-purple-400', hint: 'Pack & ship' },
            { label: 'Delivering',   color: 'bg-orange-400', hint: 'In transit' },
            { label: 'Delivered',    color: 'bg-green-400',  hint: 'Diterima' },
          ].map((step, i, arr) => (
            <span key={step.label} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${step.color}`} />
                <span className="text-xs font-semibold text-gray-600">{step.label}</span>
                <span className="text-[10px] text-gray-400 hidden sm:inline">{step.hint}</span>
              </span>
              {i < arr.length - 1 && <span className="text-gray-200 text-sm">›</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
