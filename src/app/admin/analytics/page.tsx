export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { TrendingUp, ShoppingBag, Users, Package, ImageOff, BarChart3, Repeat, Receipt, CalendarRange } from 'lucide-react'
import { normalizePhone } from '@/lib/phone'

// Julat pilihan: ?range=7 | 30 | 90 (hari). Default 7 (perangai asal).
const RANGES = [
  { days: 7, label: '7 hari' },
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
] as const

// Supabase cap 1000 baris/query — paginate (corak sama blast-audience).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = []
  const CHUNK = 1000
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await build(from, from + CHUNK - 1)
    if (error || !data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < CHUNK) break
  }
  return out
}

async function getAnalytics(rangeDays: number) {
  const supabase = createClient()

  const rangeStart = new Date()
  rangeStart.setDate(rangeStart.getDate() - (rangeDays - 1))
  rangeStart.setHours(0, 0, 0, 0)
  const startIso = rangeStart.toISOString()

  // 6 bulan untuk trend bulanan + kohort (bebas dari julat pilihan).
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const [paidOrders, topItems, ordersByStatus, newCustomers, lpPaid, lpAll, sixMoOrders, sixMoLp] = await Promise.all([
    fetchAll<{ total: number; created_at: string; user_id: string | null }>((f, t) =>
      supabase.from('orders').select('total, created_at, user_id').eq('payment_status', 'paid').gte('created_at', startIso).order('id').range(f, t)),
    // FIX: sebelum ni TIADA filter tarikh — "Top 5" kira sepanjang zaman.
    fetchAll<{ product_name: string; product_image: string | null; quantity: number; subtotal: number }>((f, t) =>
      supabase.from('order_items').select('product_name, product_image, quantity, subtotal, created_at').gte('created_at', startIso).order('id').range(f, t)),
    fetchAll<{ status: string }>((f, t) =>
      supabase.from('orders').select('status, id').gte('created_at', startIso).order('id').range(f, t)),
    fetchAll<{ created_at: string }>((f, t) =>
      supabase.from('profiles').select('created_at, id').eq('is_admin', false).gte('created_at', startIso).order('id').range(f, t)),
    fetchAll<{ total: number; created_at: string; phone: string | null }>((f, t) =>
      supabase.from('lp_guest_orders').select('total, created_at, phone').eq('status', 'confirmed').gte('created_at', startIso).order('id').range(f, t)),
    fetchAll<{ status: string; items: unknown; created_at: string }>((f, t) =>
      supabase.from('lp_guest_orders').select('status, items, created_at, id').gte('created_at', startIso).order('id').range(f, t)),
    fetchAll<{ total: number; created_at: string; user_id: string | null }>((f, t) =>
      supabase.from('orders').select('total, created_at, user_id').eq('payment_status', 'paid').gte('created_at', sixMonthsAgo.toISOString()).order('id').range(f, t)),
    fetchAll<{ total: number; created_at: string; phone: string | null }>((f, t) =>
      supabase.from('lp_guest_orders').select('total, created_at, phone').eq('status', 'confirmed').gte('created_at', sixMonthsAgo.toISOString()).order('id').range(f, t)),
  ])

  // ── Carta harian/mingguan ikut julat (>30 hari → kumpul ikut minggu) ──
  const weekly = rangeDays > 30
  const buckets: { key: string; label: string; sub: string; revenue: number; orders: number }[] = []
  if (weekly) {
    const nWeeks = Math.ceil(rangeDays / 7)
    for (let i = nWeeks - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i * 7)
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const key = monday.toISOString().slice(0, 10)
      if (!buckets.find((b) => b.key === key)) {
        buckets.push({ key, label: monday.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' }), sub: 'mgu', revenue: 0, orders: 0 })
      }
    }
  } else {
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: rangeDays <= 7 ? d.toLocaleDateString('en-MY', { weekday: 'short' }) : d.toLocaleDateString('ms-MY', { day: 'numeric' }),
        sub: rangeDays <= 7 ? d.toLocaleDateString('en-MY', { day: 'numeric' }) : d.toLocaleDateString('ms-MY', { month: 'short' }),
        revenue: 0, orders: 0,
      })
    }
  }
  const bucketKey = (iso: string) => {
    if (!weekly) return iso.slice(0, 10)
    const d = new Date(iso)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return monday.toISOString().slice(0, 10)
  }
  for (const o of [...paidOrders, ...lpPaid]) {
    const b = buckets.find((x) => x.key === bucketKey(o.created_at))
    if (b) { b.revenue += Number(o.total); b.orders += 1 }
  }

  // ── KPI julat: revenue, AOV, repeat rate ──
  const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0) + lpPaid.reduce((s, o) => s + Number(o.total), 0)
  const paidCount = paidOrders.length + lpPaid.length
  const aov = paidCount > 0 ? totalRevenue / paidCount : 0

  // Kunci customer: member = user_id; guest LP = telefon dinormalisasi.
  const custOrders = new Map<string, number>()
  for (const o of paidOrders) if (o.user_id) custOrders.set(`u:${o.user_id}`, (custOrders.get(`u:${o.user_id}`) ?? 0) + 1)
  for (const o of lpPaid) { const p = normalizePhone(o.phone); if (p) custOrders.set(`p:${p}`, (custOrders.get(`p:${p}`) ?? 0) + 1) }
  const uniqueCust = custOrders.size
  const repeatCust = [...custOrders.values()].filter((n) => n >= 2).length
  const repeatRate = uniqueCust > 0 ? (repeatCust / uniqueCust) * 100 : 0

  // ── Trend 6 bulan ──
  const months: { key: string; label: string; revenue: number; orders: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('ms-MY', { month: 'short' }), revenue: 0, orders: 0 })
  }
  for (const o of [...sixMoOrders, ...sixMoLp]) {
    const m = months.find((x) => x.key === o.created_at.slice(0, 7))
    if (m) { m.revenue += Number(o.total); m.orders += 1 }
  }

  // ── Kohort ringkas (dalam tetingkap 6 bulan): bulan belian PERTAMA ×
  // berapa % beli lagi dalam bulan-bulan berikutnya. NOTA: "pertama" dalam
  // tetingkap ini sahaja — customer lama pra-tetingkap dikira ikut belian
  // pertama mereka dalam tempoh ni.
  const firstMonth = new Map<string, string>()
  const custMonths = new Map<string, Set<string>>()
  const allSixMo = [
    ...sixMoOrders.filter((o) => o.user_id).map((o) => ({ key: `u:${o.user_id}`, month: o.created_at.slice(0, 7) })),
    ...sixMoLp.map((o) => ({ key: `p:${normalizePhone(o.phone)}`, month: o.created_at.slice(0, 7) })).filter((x) => x.key !== 'p:'),
  ].sort((a, b) => a.month.localeCompare(b.month))
  for (const { key, month } of allSixMo) {
    if (!firstMonth.has(key)) firstMonth.set(key, month)
    if (!custMonths.has(key)) custMonths.set(key, new Set())
    custMonths.get(key)!.add(month)
  }
  const cohorts = months.slice(0, 5).map((m) => {
    const members = [...firstMonth.entries()].filter(([, fm]) => fm === m.key).map(([k]) => k)
    const returned = members.filter((k) => [...custMonths.get(k)!].some((mo) => mo > m.key)).length
    return { label: m.label, size: members.length, returned, pct: members.length > 0 ? (returned / members.length) * 100 : 0 }
  })

  // ── Top products (kini ikut julat) ──
  const productMap: Record<string, { name: string; image: string | null; qty: number; revenue: number }> = {}
  for (const item of topItems) {
    if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, image: item.product_image, qty: 0, revenue: 0 }
    productMap[item.product_name].qty += item.quantity
    productMap[item.product_name].revenue += Number(item.subtotal)
  }
  for (const lpOrder of lpAll) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = Array.isArray(lpOrder.items) ? lpOrder.items : []
    for (const item of items) {
      if (!item.product_name) continue
      if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, image: null, qty: 0, revenue: 0 }
      productMap[item.product_name].qty += item.quantity ?? 1
      productMap[item.product_name].revenue += Number(item.unit_price ?? 0) * (item.quantity ?? 1)
    }
  }
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // ── Status ──
  const statusCount: Record<string, number> = {}
  for (const o of ordersByStatus) statusCount[o.status] = (statusCount[o.status] ?? 0) + 1
  for (const o of lpAll) statusCount[`lp_${o.status}`] = (statusCount[`lp_${o.status}`] ?? 0) + 1

  return {
    buckets, weekly, months, cohorts, topProducts, statusCount,
    totalRevenue, totalOrders: ordersByStatus.length + lpAll.length, paidCount,
    newCustomers: newCustomers.length, aov, repeatRate, repeatCust, uniqueCust,
    lpOrders: lpAll.length,
    maxRevenue: Math.max(...buckets.map((b) => b.revenue), 1),
    maxMonthRevenue: Math.max(...months.map((m) => m.revenue), 1),
  }
}

const statusLabel: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  delivering: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
  lp_pending: 'LP — Pending', lp_confirmed: 'LP — Confirmed', lp_cancelled: 'LP — Cancelled',
}
const statusColor: Record<string, string> = {
  pending: 'bg-yellow-400', confirmed: 'bg-blue-500', preparing: 'bg-purple-500',
  delivering: 'bg-orange-400', delivered: 'bg-green-500', cancelled: 'bg-red-400',
  lp_pending: 'bg-rose-300', lp_confirmed: 'bg-rose-500', lp_cancelled: 'bg-gray-400',
}

const RANK_STYLES = [
  'bg-yellow-100 text-yellow-700 border-yellow-200',
  'bg-gray-100 text-gray-500 border-gray-200',
  'bg-orange-100 text-orange-600 border-orange-200',
]

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams
  const rangeDays = RANGES.find((r) => String(r.days) === range)?.days ?? 7
  const a = await getAnalytics(rangeDays)
  const totalStatusOrders = Object.values(a.statusCount).reduce((s, n) => s + n, 0)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Prestasi kedai — store + landing page</p>
        </div>
        {/* Pemilih julat */}
        <div className="flex items-center gap-1.5">
          <CalendarRange className="h-4 w-4 text-gray-400" />
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/admin/analytics?range=${r.days}`}
              className={`text-xs rounded-full px-3 py-1.5 font-semibold ${rangeDays === r.days ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Jualan</span>
            <div className="bg-green-100 p-1.5 rounded-lg"><TrendingUp className="h-3.5 w-3.5 text-green-600" /></div>
          </div>
          <p className="text-xl font-black text-gray-900">RM{a.totalRevenue.toLocaleString('ms-MY', { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{a.paidCount} order berbayar</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Orders</span>
            <div className="bg-blue-100 p-1.5 rounded-lg"><ShoppingBag className="h-3.5 w-3.5 text-blue-600" /></div>
          </div>
          <p className="text-xl font-black text-gray-900">{a.totalOrders}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{a.lpOrders} dari LP</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">AOV</span>
            <div className="bg-amber-100 p-1.5 rounded-lg"><Receipt className="h-3.5 w-3.5 text-amber-600" /></div>
          </div>
          <p className="text-xl font-black text-gray-900">RM{a.aov.toFixed(2)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">purata nilai order</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Repeat rate</span>
            <div className="bg-emerald-100 p-1.5 rounded-lg"><Repeat className="h-3.5 w-3.5 text-emerald-600" /></div>
          </div>
          <p className="text-xl font-black text-gray-900">{a.repeatRate.toFixed(1)}%</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{a.repeatCust}/{a.uniqueCust} customer beli ≥2×</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Customer baru</span>
            <div className="bg-purple-100 p-1.5 rounded-lg"><Users className="h-3.5 w-3.5 text-purple-600" /></div>
          </div>
          <p className="text-xl font-black text-gray-900">{a.newCustomers}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">pendaftaran baru</p>
        </div>
      </div>

      {/* Carta revenue ikut julat */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <h2 className="font-bold text-gray-900">Revenue — {rangeDays} hari{a.weekly ? ' (mingguan)' : ''}</h2>
        </div>
        <div className="flex items-end gap-1 h-40">
          {a.buckets.map((b, i) => {
            const isLast = i === a.buckets.length - 1
            const heightPct = b.revenue > 0 ? Math.max((b.revenue / a.maxRevenue) * 100, 4) : 0
            const showValue = rangeDays <= 7 || b.revenue === a.maxRevenue
            return (
              <div key={b.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[9px] text-gray-500 font-semibold h-4 flex items-center truncate">
                  {showValue && b.revenue > 0 ? `RM${b.revenue.toFixed(0)}` : ''}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: '104px' }}>
                  <div
                    className={`w-full rounded-t ${isLast ? 'bg-red-600' : 'bg-red-200'}`}
                    style={{ height: `${heightPct}%`, minHeight: b.revenue > 0 ? '3px' : '0' }}
                  />
                </div>
                {(rangeDays <= 7 || i % Math.ceil(a.buckets.length / 10) === 0) && (
                  <div className="text-center min-w-0">
                    <p className={`text-[9px] font-bold truncate ${isLast ? 'text-gray-900' : 'text-gray-400'}`}>{b.label}</p>
                    <p className="text-[8px] text-gray-300 truncate">{b.sub}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend 6 bulan */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900">Trend 6 Bulan</h2>
          </div>
          <div className="flex items-end gap-3 h-36">
            {a.months.map((m, i) => {
              const isLast = i === a.months.length - 1
              const heightPct = m.revenue > 0 ? Math.max((m.revenue / a.maxMonthRevenue) * 100, 4) : 0
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-gray-500 font-semibold h-4">
                    {m.revenue > 0 ? `RM${(m.revenue / 1000).toFixed(1)}k` : ''}
                  </span>
                  <div className="w-full flex flex-col justify-end" style={{ height: '84px' }}>
                    <div className={`w-full rounded-t-lg ${isLast ? 'bg-gray-800' : 'bg-gray-300'}`} style={{ height: `${heightPct}%` }} />
                  </div>
                  <p className={`text-[10px] font-bold ${isLast ? 'text-gray-900' : 'text-gray-400'}`}>{m.label}</p>
                  <p className="text-[9px] text-gray-300 -mt-1">{m.orders} order</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Kohort ringkas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900">Customer Kembali Beli</h2>
          </div>
          <p className="text-[11px] text-gray-400 mb-3 leading-snug">
            Customer yang mula beli pada bulan X — berapa % beli LAGI dalam bulan berikutnya (tetingkap 6 bulan)
          </p>
          <div className="space-y-2.5">
            {a.cohorts.map((c) => (
              <div key={c.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{c.label} <span className="text-gray-400">({c.size} customer baru)</span></span>
                  <span className="text-xs font-bold text-gray-900">{c.pct.toFixed(0)}% <span className="text-[10px] text-gray-400 font-normal">({c.returned} kembali)</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900">Top 5 Product — {rangeDays} hari</h2>
          </div>
          {a.topProducts.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No data jualan</div>
          ) : (
            <div className="space-y-3">
              {a.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={`text-[10px] font-black w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${RANK_STYLES[i] ?? 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                    {i + 1}
                  </span>
                  <div className="h-8 w-8 rounded-lg border border-gray-100 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="h-3 w-3 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.qty} unit</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0">RM{p.revenue.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900">Status Orders</h2>
            {totalStatusOrders > 0 && (
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{totalStatusOrders} orders</span>
            )}
          </div>
          {Object.keys(a.statusCount).length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No orders dalam julat ini</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(a.statusCount)
                .sort((x, y) => y[1] - x[1])
                .map(([status, count]) => {
                  const pct = Math.round((count / totalStatusOrders) * 100)
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${statusColor[status] ?? 'bg-gray-300'}`} />
                          <span className="text-xs font-medium text-gray-700">{statusLabel[status] ?? status}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900">{count}</span>
                          <span className="text-[10px] text-gray-400">({pct}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${statusColor[status] ?? 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
