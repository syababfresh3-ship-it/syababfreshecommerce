'use client'

// Panel sebut harga untuk order dari Studio (config.source === 'sheet') — 3 lajur sebelah-menyebelah:
// Harga senarai (sheet 2026) | Kos (app_settings.gift_cost_config) | Harga anda (RM/kotak) →
// untung/margin live + cadangan @ margin sasaran. Simpan → PATCH /api/admin/kurma/orders/[id]
// (unit_price → subtotal/total dikira semula + snapshot list/cost/margin, migration 143).
// Order lama (katalog/manual) kekal guna panel "Quote & payment" asal — panel ini tak dipakai.
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Copy } from 'lucide-react'
import Link from 'next/link'
import { sheetQuote, rm, type SheetWeight } from '@/lib/gift-pricing'
import { EMPTY_GIFT_COST, costUnitFor, marginFor, costStatusOf, priceForMargin, missingCostFields, type GiftCostConfig } from '@/lib/gift-cost'

export interface QuoteOrder {
  id: string; status: string; payment_status: string
  quantity: number; unit_price: number; total: number; deposit_pct: number; deposit_amount: number; balance: number
  config: { kurma_id?: string; weight?: string | null; quantity?: number; requested_qty?: number }
  list_unit_price?: number | null; cost_unit?: number | null; margin_pct?: number | null
}

const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const STATUS_CLS: Record<string, string> = { bahaya: 'bg-red-50 text-red-700', perhatian: 'bg-amber-50 text-amber-700', sihat: 'bg-green-50 text-green-700' }
const r2 = (n: number) => Math.round(n * 100) / 100

export function QuotePanel({ order, patch, copyLink, busy }: {
  order: QuoteOrder
  patch: (body: Record<string, unknown>, key: string) => Promise<void>
  copyLink: (kind: 'deposit' | 'balance') => void
  busy: string | null
}) {
  const kurmaId = order.config.kurma_id ?? ''
  const weight = (order.config.weight ?? '200g') as SheetWeight
  const qty = Number(order.quantity)
  const list = useMemo(() => sheetQuote({ kurmaId, weight, qty }), [kurmaId, weight, qty])

  const [cfg, setCfg] = useState<GiftCostConfig | null>(null)
  const [cfgExists, setCfgExists] = useState(true)
  useEffect(() => {
    fetch('/api/admin/settings/gift-cost').then(r => r.json()).then(j => { setCfg(j?.config ?? EMPTY_GIFT_COST); setCfgExists(!!j?.exists) }).catch(() => setCfg(EMPTY_GIFT_COST))
  }, [])
  const cost = cfg ? costUnitFor(cfg, { kurmaId, weight, qty }) : null
  const missing = cfg ? missingCostFields(cfg, { kurmaId, weight, qty }) : []
  const target = cfg?.default_margin_pct ?? EMPTY_GIFT_COST.default_margin_pct

  const [unit, setUnit] = useState(String(Number(order.unit_price) || (list.ok ? list.perBox : 0)))
  const [pct, setPct] = useState(String(order.deposit_pct))
  const [markQuoted, setMarkQuoted] = useState(order.status === 'enquiry')

  const unitN = Number(unit) || 0
  const total = r2(unitN * qty)
  const m = cost ? marginFor(unitN, cost.total) : null
  const status = m && cost ? costStatusOf(m.untung, m.pct, target) : null
  const suggest = cost ? priceForMargin(cost.total, target) : null

  function save() {
    patch({
      unit_price: unitN,
      total,
      deposit_pct: Number(pct),
      list_unit_price: list.ok ? list.perBox : null,
      cost_unit: cost?.total ?? null,
      cost_breakdown: cost ?? null,
      margin_pct: m ? m.pct : null,
      ...(markQuoted && order.status === 'enquiry' ? { status: 'quoted' } : {}),
    }, 'quote')
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Sebut harga — senarai vs kos</p>
        <span className="text-[11px] text-gray-400">{list.ok ? `${list.kurma.name} · ${weight} · ${qty} kotak` : 'Pilihan sheet tidak sah'}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {/* Senarai */}
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-500">Harga senarai (sheet)</div>
          {list.ok ? (
            <>
              <div className="text-lg font-black text-gray-900 tabular-nums">{rm(list.perBox)}<span className="text-xs font-semibold text-gray-400">/kotak</span></div>
              <div className="text-[11px] text-gray-500">× {qty} = {rm(list.total)} · tier min {list.minTier}</div>
              <button type="button" onClick={() => setUnit(String(list.perBox))} className="mt-2 text-[11px] font-semibold text-gray-600 border border-gray-200 px-2 py-1 rounded-lg hover:bg-white">Guna senarai</button>
            </>
          ) : <div className="text-[12px] text-amber-700">{list.error}</div>}
        </div>

        {/* Kos */}
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="text-[11px] font-bold text-gray-500">Kos / kotak</div>
          {!cfg ? <Loader2 className="h-4 w-4 animate-spin text-gray-300 mt-1" /> : cost ? (
            <>
              <div className="text-lg font-black text-gray-900 tabular-nums">{rm(cost.total)}</div>
              <dl className="text-[11px] text-gray-500 grid grid-cols-2 gap-x-2">
                <dt>Kotak</dt><dd className="text-right tabular-nums">{rm(cost.box)}</dd>
                <dt>Kurma</dt><dd className="text-right tabular-nums">{rm(cost.kurma)}</dd>
                <dt>Packing</dt><dd className="text-right tabular-nums">{rm(cost.packing)}</dd>
                <dt>Hantar</dt><dd className="text-right tabular-nums">{rm(cost.delivery)}</dd>
              </dl>
            </>
          ) : (
            <div className="text-[12px] text-amber-700">
              {cfgExists ? `Isi dulu: ${missing.join(', ')}` : 'Kos belum diisi.'} <Link href="/admin/kurma/costs" className="underline font-semibold">Kos & Harga →</Link>
            </div>
          )}
        </div>

        {/* Harga anda */}
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-[11px] font-bold text-gray-500">Harga anda (RM/kotak)</div>
          <input type="number" step="0.01" min="0" value={unit} onChange={e => setUnit(e.target.value)} aria-label="Harga akhir per kotak" className={`${inp} w-full font-mono text-lg font-black mt-1`} />
          <div className="text-[11px] text-gray-500 mt-1">× {qty} = <b className="text-gray-800">{rm(total)}</b></div>
          {m && status ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold text-gray-900 tabular-nums">Untung {rm(m.untung)} ({m.pct.toFixed(1)}%)</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[status]}`}>{status}</span>
            </div>
          ) : <div className="text-[11px] text-gray-400 mt-2">Margin dikira bila kos diisi.</div>}
          {suggest !== null && (
            <button type="button" onClick={() => setUnit(String(suggest))} className="mt-2 text-[11px] font-semibold text-gray-600 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">Guna cadangan @ {target}% → {rm(suggest)}</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end mt-4">
        <div><label className="block text-xs text-gray-600 mb-1">Deposit %</label><input type="number" min="10" max="100" value={pct} onChange={e => setPct(e.target.value)} className={`${inp} w-full font-mono`} /></div>
        <div className="text-sm"><span className="block text-xs text-gray-500">Deposit (disimpan)</span><span className="font-bold text-gray-900">{rm(Number(order.deposit_amount))}</span></div>
        <div className="text-sm"><span className="block text-xs text-gray-500">Baki (disimpan)</span><span className="font-bold text-gray-900">{rm(Number(order.balance))}</span></div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={markQuoted} onChange={e => setMarkQuoted(e.target.checked)} disabled={order.status !== 'enquiry'} />Tandakan sebagai quoted</label>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button onClick={save} disabled={busy === 'quote' || !(unitN > 0)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50">{busy === 'quote' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Simpan sebut harga</button>
        <span className="text-xs text-gray-400 mr-auto">Payment: <b className="text-gray-700">{order.payment_status.replace('_', ' ')}</b>{order.list_unit_price != null && <> · senarai disimpan {rm(Number(order.list_unit_price))}</>}{order.margin_pct != null && <> · margin {Number(order.margin_pct).toFixed(1)}%</>}</span>
        <button onClick={() => copyLink('deposit')} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50"><Copy className="h-3.5 w-3.5" />Deposit link</button>
        <button onClick={() => copyLink('balance')} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50"><Copy className="h-3.5 w-3.5" />Balance link</button>
      </div>
    </div>
  )
}
