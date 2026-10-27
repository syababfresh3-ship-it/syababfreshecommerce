export const dynamic = 'force-dynamic'

// Jualan Sales & Borong — laporan ikut tempoh: ringkasan sumber (Web · LP/Iklan · Sales WhatsApp · Borong · Gift),
// jadual ikut staf sales (source 'whatsapp-<nama>') dan ikut pelanggan borong (reseller_id). Baca sahaja — tiada migration.
// Tidak bertindih: Analytics (trafik/produk), P&L (kos iklan/ROAS), Orders (senarai), Borong (jumlah seumur hidup ikut telefon).
import Link from 'next/link'
import { BarChart2, Users, Store, Package } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyLpSource } from '@/lib/admin-order-filters'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any
const EXCLUDED = new Set(['cancelled', 'refunded'])
const rm = (n: number) => `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtD = (s: string) => new Date(s).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: '2-digit' })
const iso = (d: Date) => d.toISOString().slice(0, 10)

function rangeFrom(sp: { from?: string; to?: string }) {
  const today = new Date()
  const ok = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const to = ok(sp.to) ? sp.to! : iso(today)
  const from = ok(sp.from) ? sp.from! : `${to.slice(0, 7)}-01`
  return { from, to }
}
function presets() {
  const t = new Date(); const y = t.getFullYear(), m = t.getMonth()
  const d = (x: Date) => iso(x)
  return [
    { label: 'Bulan ini', from: d(new Date(y, m, 1)), to: d(t) },
    { label: 'Bulan lepas', from: d(new Date(y, m - 1, 1)), to: d(new Date(y, m, 0)) },
    { label: '30 hari', from: d(new Date(t.getTime() - 29 * 86400000)), to: d(t) },
    { label: '90 hari', from: d(new Date(t.getTime() - 89 * 86400000)), to: d(t) },
  ]
}

interface Agg { count: number; total: number; last: string | null; lastNo: string | null }
const bump = (map: Map<string, Agg>, key: string, o: { total: number; created_at: string; order_number: string }) => {
  const a = map.get(key) ?? { count: 0, total: 0, last: null, lastNo: null }
  a.count++; a.total += o.total
  if (!a.last || o.created_at > a.last) { a.last = o.created_at; a.lastNo = o.order_number }
  map.set(key, a)
}

async function getData(from: string, to: string) {
  const sb = createAdminClient()
  const start = `${from}T00:00:00+08:00`, end = `${to}T23:59:59+08:00`
  const [lp, web, gift, rs] = await Promise.all([
    sb.from('lp_guest_orders').select('id, order_number, name, phone, total, source, reseller_id, status, payment_status, created_at, product_name, quantity').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(5000),
    sb.from('orders').select('id, total, status, created_at').gte('created_at', start).lte('created_at', end).limit(5000),
    sb.from('gift_deals').select('id, amount, stage, created_at').gte('created_at', start).lte('created_at', end).limit(2000),
    sb.from('resellers').select('id, customers(name, phone_norm)'),
  ])
  const resellerName = new Map<string, string>()
  for (const r of (rs.data ?? []) as Row[]) resellerName.set(r.id, r.customers?.name || r.customers?.phone_norm || 'Pelanggan borong')

  const lpRows = ((lp.data ?? []) as Row[]).filter(o => !EXCLUDED.has(o.status)).map(o => ({ ...o, total: Number(o.total || 0) }))
  const webRows = ((web.data ?? []) as Row[]).filter(o => !EXCLUDED.has(o.status))
  const giftRows = ((gift.data ?? []) as Row[]).filter(d => d.stage !== 'lost')

  const summary = { web: { count: 0, total: 0 }, lp: { count: 0, total: 0 }, sales: { count: 0, total: 0 }, borong: { count: 0, total: 0 }, gift: { count: giftRows.length, total: giftRows.reduce((s, d) => s + Number(d.amount || 0), 0) } }
  for (const o of webRows) { summary.web.count++; summary.web.total += Number(o.total || 0) }
  const byStaff = new Map<string, Agg>(), byReseller = new Map<string, Agg>()
  const borongOrders: Row[] = []
  for (const o of lpRows) {
    const c = classifyLpSource(o.source)
    if (c.isReseller || o.reseller_id) {
      summary.borong.count++; summary.borong.total += o.total
      bump(byReseller, o.reseller_id ?? '—', o); borongOrders.push(o)
    } else if (c.isStoreGuest) {
      summary.web.count++; summary.web.total += o.total
    } else if (c.isManual || o.source === 'crm') {
      summary.sales.count++; summary.sales.total += o.total
      bump(byStaff, c.staffName ?? (o.source === 'crm' ? 'Inbox CRM' : o.source === 'manual' ? 'Manual' : 'Tanpa nama staf'), o)
    } else {
      summary.lp.count++; summary.lp.total += o.total
    }
  }
  const sortAgg = (m: Map<string, Agg>) => [...m.entries()].sort((a, b) => b[1].total - a[1].total)
  return { summary, byStaff: sortAgg(byStaff), byReseller: sortAgg(byReseller).map(([id, a]) => [resellerName.get(id) ?? (id === '—' ? 'Tanpa pelanggan' : id), a, id] as const), borongOrders: borongOrders.slice(0, 200), resellerName, lpErr: lp.error?.message ?? null }
}

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams
  const { from, to } = rangeFrom(sp)
  const d = await getData(from, to)
  const grand = d.summary.web.total + d.summary.lp.total + d.summary.sales.total + d.summary.borong.total
  const cards = [
    { label: 'Web (kedai)', ...d.summary.web, hint: 'Checkout sendiri + tetamu' },
    { label: 'LP / Iklan', ...d.summary.lp, hint: 'Borang LP dari FB/IG/TikTok' },
    { label: 'Sales (WhatsApp)', ...d.summary.sales, hint: 'Quick Order & Inbox CRM' },
    { label: 'Borong', ...d.summary.borong, hint: 'Pelanggan borong (harga karton)' },
    { label: 'Gift kurma (deal)', ...d.summary.gift, hint: 'Deal Pipeline dicipta dalam tempoh' },
  ]
  const th = 'text-left font-bold px-3 py-2.5'
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 className="h-5 w-5 text-gray-500" />Jualan Sales & Borong</h1>
          <p className="text-sm text-gray-500 mt-0.5">{fmtD(from)} – {fmtD(to)} · order dibatal/refund dikecualikan · termasuk yang belum bayar</p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="date" name="from" defaultValue={from} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white" aria-label="Dari" />
          <input type="date" name="to" defaultValue={to} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white" aria-label="Hingga" />
          <button type="submit" className="px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800">Tunjuk</button>
          <span className="inline-flex gap-1">
            {presets().map(p => <Link key={p.label} href={`/admin/sales-report?from=${p.from}&to=${p.to}`} className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border ${p.from === from && p.to === to ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>{p.label}</Link>)}
          </span>
        </form>
      </div>
      {d.lpErr && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">Ralat baca order: {d.lpErr}</p>}

      {/* Ringkasan ikut sumber */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{c.label}</p>
            <p className="text-lg font-black text-gray-900 mt-0.5 font-mono">{rm(c.total)}</p>
            <p className="text-[11px] text-gray-500">{c.count} order · {c.hint}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-gray-900 bg-gray-900 text-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-300">Jumlah order</p>
          <p className="text-lg font-black mt-0.5 font-mono">{rm(grand)}</p>
          <p className="text-[11px] text-gray-300">{d.summary.web.count + d.summary.lp.count + d.summary.sales.count + d.summary.borong.count} order · tanpa gift deal</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ikut staf sales */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-gray-500" />Ikut staf sales</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs"><tr><th className={th}>Staf</th><th className={`${th} text-right`}>Order</th><th className={`${th} text-right`}>Jumlah</th><th className={`${th} text-right`}>Purata</th><th className={th}>Order terakhir</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {d.byStaff.map(([name, a]) => (
                  <tr key={name}>
                    <td className="px-3 py-2 font-semibold text-gray-900">{name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.count}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">{rm(a.total)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{rm(a.total / a.count)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{a.last ? `${fmtD(a.last)} · ${a.lastNo}` : '—'}</td>
                  </tr>
                ))}
                {d.byStaff.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Tiada order sales dalam tempoh ini.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Nama ikut pilihan Staf dalam Quick Order (sumber whatsapp-nama). Order tanpa nama staf dikumpul sebagai &quot;Tanpa nama staf&quot;.</p>
        </section>

        {/* Ikut pelanggan borong */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><Store className="h-4 w-4 text-gray-500" />Ikut pelanggan borong</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs"><tr><th className={th}>Pelanggan</th><th className={`${th} text-right`}>Order</th><th className={`${th} text-right`}>Jumlah</th><th className={`${th} text-right`}>Purata</th><th className={th}>Order terakhir</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {d.byReseller.map(([name, a, id]) => (
                  <tr key={id}>
                    <td className="px-3 py-2 font-semibold text-gray-900">{name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.count}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">{rm(a.total)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{rm(a.total / a.count)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{a.last ? `${fmtD(a.last)} · ${a.lastNo}` : '—'}</td>
                  </tr>
                ))}
                {d.byReseller.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Tiada order borong dalam tempoh ini.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Order Quick Order yang dipilih pelanggan borong (sumber reseller). Urus pelanggan & harga di <Link href="/admin/resellers" className="underline">Borong</Link>.</p>
        </section>
      </div>

      {/* Senarai order borong */}
      <section className="mt-6">
        <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><Package className="h-4 w-4 text-gray-500" />Order borong dalam tempoh ({d.borongOrders.length})</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs"><tr><th className={th}>Tarikh</th><th className={th}>Order</th><th className={th}>Pelanggan</th><th className={th}>Produk</th><th className={`${th} text-right`}>Jumlah</th><th className={th}>Status</th><th className={th}>Bayaran</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {d.borongOrders.map((o: Row) => (
                <tr key={o.id}>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtD(o.created_at)}</td>
                  <td className="px-3 py-2 font-mono text-gray-700"><Link href={`/admin/orders?q=${encodeURIComponent(o.order_number)}`} className="hover:underline">{o.order_number}</Link></td>
                  <td className="px-3 py-2 text-gray-900">{d.resellerName.get(o.reseller_id) ?? o.name}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[22rem] truncate">{o.product_name}{o.quantity > 1 ? ` ×${o.quantity}` : ''}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{rm(o.total)}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{o.status}</td>
                  <td className="px-3 py-2 text-xs">{o.payment_status === 'paid' ? <span className="font-semibold text-gray-900">paid</span> : <span className="text-amber-700">{o.payment_status}</span>}</td>
                </tr>
              ))}
              {d.borongOrders.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Tiada order borong dalam tempoh ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
