'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Receipt, ScanBarcode, Users, Settings2, TriangleAlert, Store, Truck, ClipboardList } from 'lucide-react'
import { POS_HOST } from '@/lib/pos/host'
import { fmtQty, rm } from '@/lib/pos/money'
import { POS_PAY_LABEL, type PosPayMethod } from '@/lib/pos/types'
import type { PosDayReport } from '@/lib/pos/reports'
import { klDateStr } from '@/lib/pos/dates'

const LINKS = [
  { href: '/admin/pos/sales', label: 'POS Sales', icon: Receipt, d: 'List, void, CSV' },
  { href: '/admin/pos/shifts', label: 'Shifts (Open/Close)', icon: ClipboardList, d: 'Opening float, cash counted, Z reports' },
  { href: '/admin/pos/products', label: 'POS Products', icon: ScanBarcode, d: 'Favourites, weight, barcode, prices' },
  { href: '/admin/pos/outlets', label: 'Outlets & Stock', icon: Store, d: 'Stock per outlet, movements, counts' },
  { href: '/admin/pos/transfers', label: 'Delivery Orders', icon: Truck, d: 'HQ → outlet DO, returns, print' },
  { href: '/admin/pos/cashiers', label: 'Cashiers & Access', icon: Users, d: 'Registers, cashiers + PIN, device accounts' },
  { href: '/admin/pos/settings', label: 'POS Settings', icon: Settings2, d: 'Receipt, DuitNow QR, discount limit' },
]

export function PosDashboardClient() {
  const [report, setReport] = useState<PosDayReport | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const today = klDateStr(new Date())
  useEffect(() => {
    fetch(`/api/admin/pos/sales?from=${today}&to=${today}`).then(async r => { const j = await r.json(); if (!r.ok) setErr(j.error ?? 'Failed'); else setReport(j.report) }).catch(() => setErr('Failed to load'))
  }, [today])
  const posUrl = POS_HOST ? `https://${POS_HOST}/pos/sell` : '/pos/sell'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">POS</h1><p className="text-sm text-gray-500">Store counter &amp; bazaar · today {today}</p></div>
        <a href={posUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold"><ExternalLink className="h-4 w-4" /> Open POS</a>
      </div>
      {err && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 inline-flex items-center gap-2"><TriangleAlert className="h-4 w-4" />{err} — run migration 155 if you have not yet.</div>}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card label="Sales today" value={String(report.sales)} sub={`${report.voids} void · ${report.pending} pending`} />
          <Card label="Revenue" value={rm(report.revenue)} sub={`discount ${rm(report.discount)}`} />
          <Card label="Cash" value={rm(report.byMethod.cash?.amount ?? 0)} sub={`change given ${rm(report.cashChange)}`} />
          <Card label="Sold by weight" value={fmtQty(report.weightKg, 'kg')} sub="not deducted from store stock" />
        </div>
      )}
      {report && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Panel title="By payment method">{(Object.keys(report.byMethod) as PosPayMethod[]).length === 0 ? <Empty /> : (Object.entries(report.byMethod) as [PosPayMethod, { count: number; amount: number }][]).map(([m, v]) => <Row key={m} a={`${POS_PAY_LABEL[m]} (${v.count})`} b={rm(v.amount)} />)}</Panel>
          <Panel title="By cashier">{report.byCashier.length === 0 ? <Empty /> : report.byCashier.map(c => <Row key={c.cashierId ?? '-'} a={`${c.name} (${c.sales})`} b={rm(c.revenue)} />)}</Panel>
          <Panel title="Top items">{report.topItems.length === 0 ? <Empty /> : report.topItems.slice(0, 8).map(i => <Row key={`${i.name}-${i.unit}`} a={`${i.name} · ${fmtQty(i.qty, i.unit)}`} b={rm(i.revenue)} />)}</Panel>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300">
            <l.icon className="h-5 w-5 text-gray-700" /><p className="font-semibold text-gray-900 mt-2">{l.label}</p><p className="text-xs text-gray-500">{l.d}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-medium text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4"><h2 className="text-sm font-semibold text-gray-900 mb-2">{title}</h2><div className="divide-y divide-gray-100">{children}</div></div>
}
function Row({ a, b }: { a: string; b: string }) { return <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-700 truncate pr-2">{a}</span><span className="font-semibold tabular-nums">{b}</span></div> }
function Empty() { return <p className="text-sm text-gray-400 py-2">No data.</p> }
