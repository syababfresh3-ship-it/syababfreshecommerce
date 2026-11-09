'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Receipt, ScanBarcode, Users, Settings2, TriangleAlert, Store, Truck, ClipboardList, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { POS_HOST } from '@/lib/pos/host'
import { fmtQty } from '@/lib/pos/money'
import { POS_PAY_LABEL } from '@/lib/pos/types'
import type { PosRangeReport } from '@/lib/pos/reports'
import { klDateStr, shiftDateStr } from '@/lib/pos/dates'

// Dashboard jualan POS (admin). Satu baris penapis di atas (julat tarikh + outlet) menskop SEMUA di bawahnya:
// jubin angka utama (dengan beza vs tempoh sebelumnya), hasil ikut hari, hasil ikut jam, produk teratas,
// kategori, kaedah bayaran, register/outlet, kasyer. Hasil = jualan paid sahaja.
// Carta: satu siri → satu warna (monokrom admin), lajur ≤24px, hujung data bulat 4px, jurang 2px, grid halus,
// tooltip pada hover & fokus, paparan jadual sebagai alternatif. Semasa muat semula, paparan lama kekal (pudar).
// UI Bahasa Inggeris (seluruh seksyen admin POS).

const LINKS = [
  { href: '/admin/pos/sales', label: 'POS Sales', icon: Receipt, d: 'List, void, CSV' },
  { href: '/admin/pos/shifts', label: 'Shifts (Open/Close)', icon: ClipboardList, d: 'Opening float, cash counted, Z reports' },
  { href: '/admin/pos/products', label: 'POS Products', icon: ScanBarcode, d: 'Favourites, weight, barcode, prices' },
  { href: '/admin/pos/outlets', label: 'Outlets & Stock', icon: Store, d: 'Stock per outlet, movements, counts' },
  { href: '/admin/pos/transfers', label: 'Delivery Orders', icon: Truck, d: 'HQ → outlet DO, returns, print' },
  { href: '/admin/pos/cashiers', label: 'Cashiers & Access', icon: Users, d: 'Registers, cashiers + PIN, device accounts' },
  { href: '/admin/pos/settings', label: 'POS Settings', icon: Settings2, d: 'Receipt, DuitNow QR, discount limit' },
]

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom'
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: '7d', label: 'Last 7 days' }, { id: '30d', label: 'Last 30 days' }, { id: 'month', label: 'This month' },
]
interface OutletLite { id: string; code: string; name: string; type: string; is_active: boolean }

/** RM dengan pemisah ribu (dashboard memaparkan jumlah besar; resit/POS kekal guna rm()). */
const money = (v: number) => `RM${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayLabel = (ymd: string) => `${Number(ymd.slice(8))} ${MONTHS.at(Number(ymd.slice(5, 7)) - 1)}`
const hourLabel = (h: number) => `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`
const rmCompact = (v: number) => v >= 10_000 ? `RM${Math.round(v / 1000)}K` : v >= 1000 ? `RM${(v / 1000).toFixed(1).replace(/\.0$/, '')}K` : `RM${Math.round(v)}`
/** Siling "cantik" untuk paksi Y (1 / 2 / 2.5 / 5 × 10ⁿ). */
function niceMax(v: number): number {
  if (!(v > 0)) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow
}

export function PosDashboardClient() {
  const [today] = useState(() => klDateStr(new Date()))
  const [preset, setPreset] = useState<Preset>('7d')
  const [from, setFrom] = useState(() => shiftDateStr(klDateStr(new Date()), -6))
  const [to, setTo] = useState(() => klDateStr(new Date()))
  const [outlet, setOutlet] = useState('')
  const [report, setReport] = useState<PosRangeReport | null>(null)
  const [outlets, setOutlets] = useState<OutletLite[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [topSort, setTopSort] = useState<'revenue' | 'qty'>('revenue')
  const [showAllTop, setShowAllTop] = useState(false)

  const key = `${from}|${to}|${outlet}`
  const stale = loadedKey !== key      // sedang muat julat baharu → kekalkan paparan lama, pudar
  useEffect(() => {
    let alive = true
    fetch(`/api/admin/pos/report?from=${from}&to=${to}${outlet ? `&outlet=${outlet}` : ''}`).then(async r => {
      const j = await r.json().catch(() => ({}))
      if (!alive) return
      if (!r.ok) { setErr(j.error ?? 'Failed to load'); setLoadedKey(key); return }
      setErr(null); setReport(j.report); setOutlets(j.outlets ?? []); setLoadedKey(key)
    }).catch(() => { if (alive) { setErr('Failed to load'); setLoadedKey(key) } })
    return () => { alive = false }
  }, [from, to, outlet, key])

  const pick = (p: Preset) => {
    setPreset(p)
    if (p === 'today') { setFrom(today); setTo(today) }
    else if (p === 'yesterday') { const y = shiftDateStr(today, -1); setFrom(y); setTo(y) }
    else if (p === '7d') { setFrom(shiftDateStr(today, -6)); setTo(today) }
    else if (p === '30d') { setFrom(shiftDateStr(today, -29)); setTo(today) }
    else if (p === 'month') { setFrom(`${today.slice(0, 8)}01`); setTo(today) }
  }

  const posUrl = POS_HOST ? `https://${POS_HOST}/pos/sell` : '/pos/sell'
  const t = report?.totals
  const single = report ? report.days === 1 : from === to
  const prevLabel = report ? (report.days === 1 ? `vs ${dayLabel(report.prev.from)}` : `vs previous ${report.days} days`) : ''

  const topItems = useMemo(() => {
    const list = (report?.topItems ?? []).slice()
    list.sort((a, b) => topSort === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty)
    return list
  }, [report, topSort])
  const topShown = showAllTop ? topItems : topItems.slice(0, 10)
  const topMax = Math.max(1, ...topItems.map(i => topSort === 'revenue' ? i.revenue : i.qty))
  const hoursWithSales = (report?.byHour ?? []).filter(h => h.sales > 0)
  const hourFrom = hoursWithSales.length ? Math.max(0, Math.min(...hoursWithSales.map(h => h.hour)) - 1) : 8
  const hourTo = hoursWithSales.length ? Math.min(23, Math.max(...hoursWithSales.map(h => h.hour)) + 1) : 22
  const hourData = (report?.byHour ?? []).filter(h => h.hour >= hourFrom && h.hour <= hourTo)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">POS</h1><p className="text-sm text-gray-500">Store counter &amp; bazaar sales{report ? ` · ${dayLabel(report.from)}${report.from !== report.to ? ` – ${dayLabel(report.to)}` : ''}` : ''}</p></div>
        <a href={posUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold"><ExternalLink className="h-4 w-4" /> Open POS</a>
      </div>

      {/* Penapis — satu baris, menskop semua di bawah */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p => <button key={p.id} type="button" onClick={() => pick(p.id)} className={`h-9 px-3 rounded-lg border text-sm font-semibold ${preset === p.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{p.label}</button>)}
        <span className="mx-1 h-6 w-px bg-gray-200" />
        <input type="date" value={from} max={to} onChange={e => { if (e.target.value) { setFrom(e.target.value); setPreset('custom') } }} aria-label="From date" className="h-9 px-2 rounded-lg border border-gray-300 text-sm bg-white" />
        <span className="text-gray-400">–</span>
        <input type="date" value={to} min={from} max={today} onChange={e => { if (e.target.value) { setTo(e.target.value); setPreset('custom') } }} aria-label="To date" className="h-9 px-2 rounded-lg border border-gray-300 text-sm bg-white" />
        {outlets.length > 0 && (
          <select value={outlet} onChange={e => setOutlet(e.target.value)} aria-label="Outlet" className="h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white">
            <option value="">All outlets</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.code} · {o.name}{o.is_active ? '' : ' (inactive)'}</option>)}
          </select>
        )}
      </div>

      {err && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 inline-flex items-center gap-2"><TriangleAlert className="h-4 w-4" />{err}</div>}

      <div className={`space-y-5 transition-opacity ${stale && report ? 'opacity-50' : ''}`} aria-busy={stale}>
        {!report && !err && <p className="py-16 text-center text-sm text-gray-400">Loading sales…</p>}

        {report && t && (
          <>
            {/* Jubin angka utama */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatTile label="Revenue" value={money(t.revenue)} delta={deltaPct(t.revenue, report.prev.revenue)} deltaLabel={prevLabel} />
              <StatTile label="Sales" value={String(t.sales)} delta={deltaPct(t.sales, report.prev.sales)} deltaLabel={prevLabel} />
              <StatTile label="Average sale" value={money(t.avgSale)} sub={t.sales ? `${t.sales} paid ${t.sales === 1 ? 'sale' : 'sales'}` : 'no paid sales'} />
              <StatTile label="Items sold" value={String(t.itemsPcs)} sub={t.weightKg > 0 ? `+ ${fmtQty(t.weightKg, 'kg')} by weight` : 'packs / pieces'} />
              <StatTile label="Discounts given" value={money(t.discount)} sub={t.revenue > 0 ? `${((t.discount / (t.revenue + t.discount)) * 100).toFixed(1)}% of gross` : undefined} />
              <StatTile label="Voided sales" value={String(t.voids)} sub={t.voids ? `${money(t.voidAmount)} reversed` : t.pending ? `${t.pending} pending` : 'none'} />
            </div>

            {t.sales === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                <p className="font-semibold text-gray-900">No paid sales in this period</p>
                <p className="text-sm text-gray-500 mt-1">Pick another date range, or open the POS to start selling.</p>
              </div>
            ) : (
              <>
                <div className={`grid gap-4 ${single ? '' : 'xl:grid-cols-3'}`}>
                  {!single && (
                    <Card title="Revenue by day" className="xl:col-span-2">
                      <ColumnChart ariaLabel="Revenue by day" data={report.byDay.map(d => ({ key: d.date, short: dayLabel(d.date), label: dayLabel(d.date), value: d.revenue, sub: `${d.sales} ${d.sales === 1 ? 'sale' : 'sales'}` }))}
                        table={{ head: ['Date', 'Sales', 'Revenue'], rows: report.byDay.map(d => [dayLabel(d.date), String(d.sales), money(d.revenue)]) }} />
                    </Card>
                  )}
                  <Card title={single ? 'Revenue by hour' : 'Busiest hours'} subtitle={single ? undefined : 'Revenue by hour of day, whole period'}>
                    <ColumnChart ariaLabel="Revenue by hour of day" data={hourData.map(h => ({ key: String(h.hour), short: hourLabel(h.hour), label: `${hourLabel(h.hour)} – ${hourLabel((h.hour + 1) % 24)}`, value: h.revenue, sub: `${h.sales} ${h.sales === 1 ? 'sale' : 'sales'}` }))}
                      table={{ head: ['Hour', 'Sales', 'Revenue'], rows: hourData.filter(h => h.sales > 0).map(h => [`${hourLabel(h.hour)} – ${hourLabel((h.hour + 1) % 24)}`, String(h.sales), money(h.revenue)]) }} />
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <Card title="Top products" className="xl:col-span-2" action={
                    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs font-semibold">
                      <button type="button" onClick={() => setTopSort('revenue')} className={`h-8 px-3 ${topSort === 'revenue' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>By revenue</button>
                      <button type="button" onClick={() => setTopSort('qty')} className={`h-8 px-3 ${topSort === 'qty' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>By quantity</button>
                    </div>}>
                    <ol className="divide-y divide-gray-100">
                      {topShown.map((i, idx) => (
                        <BarRow key={`${i.name}|${i.variant ?? ''}|${i.unit}`} rank={idx + 1} label={i.name} sub={i.variant ?? (i.unit === 'kg' ? 'by weight' : undefined)}
                          value={topSort === 'revenue' ? money(i.revenue) : fmtQty(i.qty, i.unit)} secondary={topSort === 'revenue' ? fmtQty(i.qty, i.unit) : money(i.revenue)}
                          pct={((topSort === 'revenue' ? i.revenue : i.qty) / topMax) * 100} />
                      ))}
                    </ol>
                    {topItems.length > 10 && <button type="button" onClick={() => setShowAllTop(v => !v)} className="mt-2 text-sm font-semibold text-gray-700 underline">{showAllTop ? 'Show top 10' : `Show all ${topItems.length} products`}</button>}
                  </Card>
                  <Card title="By category">
                    <ol className="divide-y divide-gray-100">
                      {report.byCategory.map(c => <BarRow key={c.name} label={c.name} value={money(c.revenue)} secondary={share(c.revenue, t.revenue)} pct={(c.revenue / Math.max(1, report.byCategory[0]?.revenue ?? 1)) * 100} />)}
                    </ol>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card title="By payment method">
                    <ol className="divide-y divide-gray-100">
                      {report.byMethod.map(m => <BarRow key={m.method} label={POS_PAY_LABEL[m.method]} sub={`${m.count} ${m.count === 1 ? 'payment' : 'payments'}`} value={money(m.amount)} secondary={share(m.amount, t.revenue)} pct={(m.amount / Math.max(1, report.byMethod[0]?.amount ?? 1)) * 100} />)}
                    </ol>
                  </Card>
                  <Card title="By register">
                    <ol className="divide-y divide-gray-100">
                      {report.byRegister.map(r => <BarRow key={r.registerId ?? '-'} label={`${r.code} · ${r.name}`} sub={r.outlet ?? undefined} value={money(r.revenue)} secondary={`${r.sales} ${r.sales === 1 ? 'sale' : 'sales'}`} pct={(r.revenue / Math.max(1, report.byRegister[0]?.revenue ?? 1)) * 100} />)}
                    </ol>
                  </Card>
                  <Card title="By cashier">
                    <ol className="divide-y divide-gray-100">
                      {report.byCashier.map(c => <BarRow key={c.name} label={c.name} value={money(c.revenue)} secondary={`${c.sales} ${c.sales === 1 ? 'sale' : 'sales'}`} pct={(c.revenue / Math.max(1, report.byCashier[0]?.revenue ?? 1)) * 100} />)}
                    </ol>
                  </Card>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300">
            <l.icon className="h-5 w-5 text-gray-700" /><p className="font-semibold text-gray-900 mt-2">{l.label}</p><p className="text-xs text-gray-500">{l.d}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

const deltaPct = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
const share = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : '—')

function StatTile({ label, value, sub, delta, deltaLabel }: { label: string; value: string; sub?: string; delta?: number | null; deltaLabel?: string }) {
  const Icon = delta == null || Math.abs(delta) < 0.05 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      {delta !== undefined ? (
        <p className="text-xs text-gray-500 mt-1 inline-flex items-center gap-1">
          <Icon className={`h-3.5 w-3.5 ${delta != null && delta < -0.05 ? 'text-red-700' : 'text-gray-700'}`} />
          <span className="font-semibold text-gray-700">{delta == null ? 'no earlier sales' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}</span>{delta != null && deltaLabel ? ` ${deltaLabel}` : ''}
        </p>
      ) : sub ? <p className="text-xs text-gray-400 mt-1">{sub}</p> : null}
    </div>
  )
}

function Card({ title, subtitle, action, className = '', children }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div><h2 className="text-sm font-semibold text-gray-900">{title}</h2>{subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Baris berbar (kedudukan → label → nilai) — bar nipis satu warna, teks dalam dakwat biasa. */
function BarRow({ rank, label, sub, value, secondary, pct }: { rank?: number; label: string; sub?: string; value: string; secondary?: string; pct: number }) {
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-gray-800">{rank != null && <span className="inline-block w-6 text-xs tabular-nums text-gray-400">{rank}</span>}{label}{sub && <span className="text-gray-400"> · {sub}</span>}</span>
        <span className="shrink-0 tabular-nums"><span className="font-semibold text-gray-900">{value}</span>{secondary && <span className="text-xs text-gray-400"> · {secondary}</span>}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-gray-900" style={{ width: `${Math.max(pct > 0 ? 1.5 : 0, Math.min(100, pct))}%` }} /></div>
    </li>
  )
}

interface ColDatum { key: string; short: string; label: string; value: number; sub?: string }

/** Carta lajur satu siri (hasil). Setiap lajur = butang (hover + fokus papan kekunci) dengan kawasan sasaran penuh tinggi. */
function ColumnChart({ data, ariaLabel, table }: { data: ColDatum[]; ariaLabel: string; table: { head: string[]; rows: string[][] } }) {
  const [hover, setHover] = useState<number | null>(null)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const max = niceMax(Math.max(0, ...data.map(d => d.value)))
  const every = Math.max(1, Math.ceil(data.length / 8))
  const h = hover != null ? data.at(hover) : undefined
  const tipLeft = hover != null && data.length ? Math.min(88, Math.max(12, ((hover + 0.5) / data.length) * 100)) : 50

  return (
    <div>
      <div className="flex justify-end mb-2">
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs font-semibold">
          <button type="button" onClick={() => setView('chart')} className={`h-7 px-2.5 ${view === 'chart' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>Chart</button>
          <button type="button" onClick={() => setView('table')} className={`h-7 px-2.5 ${view === 'table' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>Table</button>
        </div>
      </div>
      {view === 'table' ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 sticky top-0"><tr>{table.head.map((c, i) => <th key={c} className={`px-3 py-2 ${i > 0 ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{table.rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-3 py-1.5 tabular-nums ${i > 0 ? 'text-right' : 'text-gray-700'}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2" role="group" aria-label={ariaLabel}>
          <div className="relative w-11 shrink-0 h-44 text-[11px] text-gray-400 tabular-nums">
            {[0, 50, 100].map(p => <span key={p} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${p}%` }}>{rmCompact(max * (1 - p / 100))}</span>)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="relative h-44">
              {[0, 50].map(p => <div key={p} className="absolute inset-x-0 border-t border-gray-100" style={{ top: `${p}%` }} />)}
              <div className="absolute inset-x-0 bottom-0 border-t border-gray-300" />
              <div className="absolute inset-0 flex items-end gap-[2px]">
                {data.map((d, i) => (
                  <button key={d.key} type="button" aria-label={`${d.label}: ${money(d.value)}${d.sub ? `, ${d.sub}` : ''}`}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(cur => (cur === i ? null : cur))} onFocus={() => setHover(i)} onBlur={() => setHover(cur => (cur === i ? null : cur))}
                    className="flex-1 min-w-0 h-full flex items-end justify-center focus:outline-none focus-visible:bg-gray-50">
                    <span className={`block w-full max-w-[24px] rounded-t-[4px] ${hover === i ? 'bg-gray-500' : 'bg-gray-900'}`} style={{ height: `${max > 0 ? (d.value / max) * 100 : 0}%`, minHeight: d.value > 0 ? 2 : 0 }} />
                  </button>
                ))}
              </div>
              {h && (
                <div className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm text-xs whitespace-nowrap" style={{ left: `${tipLeft}%` }}>
                  <p className="font-bold text-gray-900 tabular-nums">{money(h.value)}</p>
                  <p className="text-gray-500">{h.label}{h.sub ? ` · ${h.sub}` : ''}</p>
                </div>
              )}
            </div>
            <div className="flex gap-[2px] mt-1.5 text-[11px] text-gray-400">
              {data.map((d, i) => <span key={d.key} className="flex-1 min-w-0 text-center whitespace-nowrap overflow-visible">{i % every === 0 ? d.short : ''}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
