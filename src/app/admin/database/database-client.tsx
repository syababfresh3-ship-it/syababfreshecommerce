'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Database, Download, Megaphone, RefreshCw, Search, X, Loader2 } from 'lucide-react'
import { SEGMENT_CONFIG, type Segment } from '../customers/segment-utils'

// ============================================================
// Database Pelanggan — klien.
// Semua penapis sisi-klien atas senarai penuh (≈2k baris) — laju, sifar IO DB.
// Tindakan pukal HANYA bila ada yang ditanda (tiada fallback "tiada tanda = semua",
// elak tersalah blast seluruh database). Ikon lucide line sahaja — tiada emoji.
// ============================================================

export interface DbRow {
  id: string; name: string | null; phone_norm: string; email: string | null
  sources: string[]; tags: string[]; is_reseller: boolean
  order_count: number; total_spend: number
  first_order_at: string | null; last_order_at: string | null; first_seen_at: string | null
  consent_wa: boolean | null
  product_names: string[]; coupon_codes: string[]; coupon_count: number
  segment: Segment; channel: string
}

const SEGMENT_ORDER: (Segment | 'all')[] = ['all', 'vip', 'active', 'new', 'at_risk', 'inactive', 'no_orders']
const SOURCES = ['lp', 'store', 'lead', 'tiktok', 'whatsapp', 'web', 'manual']
const MIN_ORDERS = [0, 1, 2, 3, 5] as const
const LAST_DAYS = [0, 30, 60, 90] as const
const PAGE_SIZE = 50
const BLAST_CAP = 5000 // had POST /api/whatsapp/blast selepas resolve

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const fmtRM = (n: number) => `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export function DatabaseClient({ rows }: { rows: DbRow[] }) {
  const router = useRouter()

  // Penapis
  const [q, setQ] = useState('')
  const [minOrders, setMinOrders] = useState<(typeof MIN_ORDERS)[number]>(1) // lalai: pembeli sahaja
  const [coupon, setCoupon] = useState<'all' | 'yes' | 'no'>('all')
  const [couponCode, setCouponCode] = useState('all')
  const [product, setProduct] = useState('all')
  const [lastDays, setLastDays] = useState<(typeof LAST_DAYS)[number]>(0)
  const [seg, setSeg] = useState<Segment | 'all'>('all')
  const [source, setSource] = useState('all')
  const [page, setPage] = useState(1)

  // Pilihan
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  // Pilihan dropdown dari data sebenar
  const productOptions = useMemo(() => {
    const s = new Set<string>(); rows.forEach(r => r.product_names.forEach(p => s.add(p))); return [...s].sort()
  }, [rows])
  const couponOptions = useMemo(() => {
    const s = new Set<string>(); rows.forEach(r => r.coupon_codes.forEach(c => s.add(c))); return [...s].sort()
  }, [rows])

  const filtered = useMemo(() => {
    const now = Date.now()
    const qq = q.trim().toLowerCase(); const qd = qq.replace(/\D/g, '')
    return rows.filter(r => {
      if (r.order_count < minOrders) return false
      if (coupon === 'yes' && r.coupon_count === 0) return false
      if (coupon === 'no' && r.coupon_count > 0) return false
      if (couponCode !== 'all' && !r.coupon_codes.includes(couponCode)) return false
      if (product !== 'all' && !r.product_names.includes(product)) return false
      if (lastDays > 0) {
        if (!r.last_order_at) return false
        if ((now - new Date(r.last_order_at).getTime()) / 86_400_000 > lastDays) return false
      }
      if (seg !== 'all' && r.segment !== seg) return false
      if (source !== 'all' && !r.sources.includes(source)) return false
      if (qq && !((r.name ?? '').toLowerCase().includes(qq) || (qd && r.phone_norm.includes(qd)) || (r.email ?? '').toLowerCase().includes(qq))) return false
      return true
    })
  }, [rows, q, minOrders, coupon, couponCode, product, lastDays, seg, source])

  useEffect(() => { setPage(1) }, [q, minOrders, coupon, couponCode, product, lastDays, seg, source])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = useMemo(() => ({
    total: rows.length,
    buyers: rows.filter(r => r.order_count >= 1).length,
    repeat: rows.filter(r => r.order_count >= 2).length,
    three: rows.filter(r => r.order_count >= 3).length,
    coupon: rows.filter(r => r.coupon_count > 0).length,
  }), [rows])

  // Pilihan — corak contacts-client.tsx:64-77
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))
  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAllFiltered = () => setSelected(prev => {
    const n = new Set(prev)
    if (allFilteredSelected) filtered.forEach(r => n.delete(r.id)); else filtered.forEach(r => n.add(r.id))
    return n
  })
  const selectedRows = useMemo(() => rows.filter(r => selected.has(r.id)), [rows, selected])

  // Export CSV — corak orders-table-client.tsx:84-108 (BOM + sentiasa petik)
  function exportCsv() {
    if (!selectedRows.length) return
    const header = ['name', 'phone', 'email', 'order_count', 'total_spend', 'first_order_at', 'last_order_at', 'segment', 'sources', 'product_names', 'coupon_codes', 'coupon_count']
    const body = selectedRows.map(r => [
      r.name ?? '', r.phone_norm, r.email ?? '', r.order_count, r.total_spend.toFixed(2),
      r.first_order_at ?? '', r.last_order_at ?? '', r.segment, r.sources.join(' | '),
      r.product_names.join(' | '), r.coupon_codes.join(' | '), r.coupon_count,
    ])
    const csv = [header, ...body].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `database-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success(`${selectedRows.length} rows exported`)
  }

  // Blast WA Rasmi — serah ke wizard /admin/crm/blast/new melalui sessionStorage.
  // <button> + router.push, BUKAN <Link>: cmd-klik ke tab baharu hilang sessionStorage.
  function goBlast() {
    if (!selected.size) return
    if (selected.size > BLAST_CAP) { toast.error(`Maximum ${BLAST_CAP} recipients per blast.`); return }
    const n = selected.size
    const d = new Date(); const dd = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    try {
      sessionStorage.setItem('blast-handoff', JSON.stringify({
        customerIds: [...selected],
        label: `${n} customers from Customer Database`,
        name: `Database — ${n} customers — ${dd}`,
      }))
    } catch { toast.error('Browser blocked session storage — could not hand off the list.'); return }
    router.push('/admin/crm/blast/new')
  }

  async function refreshNow() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/database/refresh', { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Refresh failed'); return }
      toast.success(`Refreshed: ${j.written} rows · ${j.withProducts} with products · ${j.withCoupons} used a coupon${j.failed ? ` · ${j.failed} failed` : ''}`)
      router.refresh()
    } catch { toast.error('Could not reach the server') }
    finally { setRefreshing(false) }
  }

  const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300'

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Database className="h-5 w-5 text-gray-700" /> Customer Database</h1>
          <p className="text-sm text-gray-400 mt-0.5">Who bought, how many times, what they bought, coupons used — tick rows to export or blast</p>
        </div>
        <button onClick={refreshNow} disabled={refreshing}
          className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-3.5 py-2 rounded-xl disabled:opacity-50">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh now
        </button>
      </div>

      {/* Stat cards = penapis pantas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {[
          { label: 'All records', value: stats.total, active: minOrders === 0 && coupon === 'all', onClick: () => { setMinOrders(0); setCoupon('all') } },
          { label: 'Buyers', value: stats.buyers, active: minOrders === 1 && coupon === 'all', onClick: () => { setMinOrders(1); setCoupon('all') } },
          { label: 'Repeat (2+)', value: stats.repeat, active: minOrders === 2 && coupon === 'all', onClick: () => { setMinOrders(2); setCoupon('all') } },
          { label: '3+ orders', value: stats.three, active: minOrders === 3 && coupon === 'all', onClick: () => { setMinOrders(3); setCoupon('all') } },
          { label: 'Used a coupon', value: stats.coupon, active: coupon === 'yes', onClick: () => { setCoupon('yes'); setMinOrders(1) } },
        ].map(s => (
          <button key={s.label} onClick={s.onClick}
            className={`text-left bg-white border rounded-2xl px-4 py-3 shadow-sm transition-all ${s.active ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100 hover:border-gray-300'}`}>
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-xl font-black mt-0.5 text-gray-900 tabular-nums">{s.value.toLocaleString('en-MY')}</p>
          </button>
        ))}
      </div>

      {/* Penapis */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm mb-4 space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / phone / email…" className={`${inp} w-full pl-9`} />
          {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={minOrders} onChange={e => setMinOrders(Number(e.target.value) as (typeof MIN_ORDERS)[number])} className={inp}>
            {MIN_ORDERS.map(n => <option key={n} value={n}>{n === 0 ? 'All (incl. leads)' : `≥ ${n} orders`}</option>)}
          </select>
          <select value={coupon} onChange={e => setCoupon(e.target.value as typeof coupon)} className={inp}>
            <option value="all">Coupon: any</option><option value="yes">Used a coupon</option><option value="no">Never used a coupon</option>
          </select>
          <select value={couponCode} onChange={e => setCouponCode(e.target.value)} className={inp} disabled={couponOptions.length === 0}>
            <option value="all">Coupon code: any</option>
            {couponOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={product} onChange={e => setProduct(e.target.value)} className={`${inp} max-w-[220px]`} disabled={productOptions.length === 0}>
            <option value="all">Product: any</option>
            {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={lastDays} onChange={e => setLastDays(Number(e.target.value) as (typeof LAST_DAYS)[number])} className={inp}>
            {LAST_DAYS.map(d => <option key={d} value={d}>{d === 0 ? 'Last order: any time' : `Ordered within ${d} days`}</option>)}
          </select>
          <select value={seg} onChange={e => setSeg(e.target.value as Segment | 'all')} className={inp}>
            {SEGMENT_ORDER.map(s => <option key={s} value={s}>{s === 'all' ? 'Segment: any' : SEGMENT_CONFIG[s].label}</option>)}
          </select>
          <select value={source} onChange={e => setSource(e.target.value)} className={inp}>
            <option value="all">Source: any</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Baris pilih-semua + kiraan */}
      <div className="flex items-center justify-between mb-2 gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} disabled={filtered.length === 0} className="rounded text-gray-800 focus:ring-gray-400" />
          Select all filtered ({filtered.length.toLocaleString('en-MY')})
        </label>
        <p className="text-xs text-gray-400 tabular-nums">
          {filtered.length === 0 ? '0 customers' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString('en-MY')}`}
        </p>
      </div>

      {/* Jadual — boleh skrol mendatar pada skrin sempit */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-3 py-2.5 w-8"></th>
              <th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5 text-right">Orders</th>
              <th className="px-3 py-2.5 text-right">Spend</th>
              <th className="px-3 py-2.5">First order</th>
              <th className="px-3 py-2.5">Last order</th>
              <th className="px-3 py-2.5">Products</th>
              <th className="px-3 py-2.5">Coupons</th>
              <th className="px-3 py-2.5">Segment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageItems.map(r => {
              const sel = selected.has(r.id)
              const sc = SEGMENT_CONFIG[r.segment]
              return (
                <tr key={r.id} className={`hover:bg-gray-50 ${sel ? 'bg-gray-50' : ''}`}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={sel} onChange={() => toggleOne(r.id)} className="rounded text-gray-800 focus:ring-gray-400" /></td>
                  <td className="px-3 py-2.5 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 truncate max-w-[220px]">{r.name ?? '—'}</p>
                      {r.is_reseller && <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">RESELLER</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{r.phone_norm}{r.email ? ` · ${r.email}` : ''}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">{r.order_count}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">{fmtRM(r.total_spend)}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(r.first_order_at)}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(r.last_order_at)}</td>
                  <td className="px-3 py-2.5 max-w-[260px]">
                    <div className="flex flex-wrap gap-1">
                      {r.product_names.slice(0, 3).map(p => <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 truncate max-w-[140px]" title={p}>{p}</span>)}
                      {r.product_names.length > 3 && <span className="text-[10px] text-gray-400" title={r.product_names.slice(3).join(', ')}>+{r.product_names.length - 3}</span>}
                      {r.product_names.length === 0 && <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.coupon_codes.map(c => <span key={c} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">{c}</span>)}
                      {r.coupon_codes.length === 0 && <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${sc.color}`}>{sc.label}</span></td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-sm text-gray-400 py-10 text-center">No customers match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginasi */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹ Prev</button>
          <span className="text-sm text-gray-500 tabular-nums">Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next ›</button>
        </div>
      )}

      {/* Bar pukal — muncul hanya bila ada yang ditanda.
          `fixed`, BUKAN `sticky`: admin-shell.tsx:25 membungkus kandungan dengan
          overflow-hidden, yang membatalkan position:sticky (bar tersangkut di hujung
          senarai, bukan melekat di dasar). fixed lepas dari ancestor sepenuhnya.
          Spacer h-20 supaya baris/paginasi terakhir tak tertutup bar. */}
      {selected.size > 0 && (
        <>
        <div className="h-20" aria-hidden />
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 z-50 pointer-events-none">
          <div className="pointer-events-auto sm:min-w-[440px] bg-gray-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold tabular-nums">{selected.size.toLocaleString('en-MY')} selected</span>
            <div className="flex-1" />
            <button onClick={exportCsv} className="flex items-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={goBlast} disabled={selected.size > BLAST_CAP}
              title={selected.size > BLAST_CAP ? `Maximum ${BLAST_CAP} recipients` : undefined}
              className="flex items-center gap-1.5 text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              <Megaphone className="h-4 w-4" /> Blast WA Official
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-300 hover:text-white underline">Clear</button>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
