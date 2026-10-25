'use client'

// Kalkulator harga gift box untuk team sale — data dari Sheet "GIFT BOX CUSTOM 2026"
// (app_settings.gift_cost_sheet). Pilih kurma · berat · kuantiti → kos/kotak & harga Sheet (tier ikut
// kuantiti) → main margin (%) atau harga sendiri → untung/kotak, jumlah untung & jualan, banding
// panduan margin. `onUse` (pilihan) → tambah sebagai item sebut harga. Tiada tulisan ke pelayan.
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Calculator, Plus, RefreshCw } from 'lucide-react'
import { findSheetRow, marginPct, r2, sheetItemName, sheetTiers, type GiftCostSheet } from '@/lib/gift-cost-sheet'

const rm = (n: number) => `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-gray-900'
const lbl = 'block text-[11px] font-bold text-gray-500 mb-1'
const marginCls = (p: number) => p >= 40 ? 'text-green-700' : p >= 30 ? 'text-amber-700' : 'text-red-700'
/** Harga untuk margin sasaran m% atas harga: harga = kos / (1 − m/100). */
const priceForMargin = (cost: number, m: number) => m >= 100 ? 0 : r2(cost / (1 - m / 100))
/** Band panduan margin dari Sheet ikut kuantiti (label cth "300–1000 pcs"). */
function bandFor(sheet: GiftCostSheet, qty: number) {
  for (const b of sheet.bands) {
    const m = b.qty_label.replace(/,/g, '').match(/(\d+)\s*[–-]\s*(\d+)/)
    if (m && qty >= Number(m[1]) && qty <= Number(m[2])) return b
  }
  return null
}

export function GiftPriceCalculator({ onUse, defaultQty = 500, compact = false }: {
  onUse?: (item: { name: string; description: string; qty: number; unit: string; rate: number }) => void
  defaultQty?: number; compact?: boolean
}) {
  const [sheet, setSheet] = useState<GiftCostSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [kurma, setKurma] = useState('')
  const [weight, setWeight] = useState('')
  const [qty, setQty] = useState(String(defaultQty))
  const [margin, setMargin] = useState('')     // '' = ikut harga Sheet
  const [price, setPrice] = useState('')      // harga anda (RM/kotak); '' = ikut margin/Sheet
  // Pecahan kos boleh diubah (cuba-cuba) — disimpan ikut kunci baris Sheet supaya reset bila tukar kurma/berat/tier
  const [ov, setOv] = useState<{ key: string; vals: Record<string, string> }>({ key: '', vals: {} })

  useEffect(() => {
    let alive = true
    fetch('/api/admin/settings/gift-cost-sheet').then(r => r.ok ? r.json() : null).then(j => {
      if (!alive) return
      const s: GiftCostSheet | null = j?.sheet ?? null
      setSheet(s); setLoading(false)
      if (s?.kurma?.[0]) { setKurma(k => k || s.kurma[0]); const w = s.rows.find(r => r.kurma === s.kurma[0])?.weight; setWeight(x => x || w || '') }
    }).catch(() => setLoading(false))
    return () => { alive = false }
  }, [])

  const weights = useMemo(() => sheet ? [...new Set(sheet.rows.filter(r => r.kurma === kurma).map(r => r.weight))] : [], [sheet, kurma])
  // Berat berkesan diterbitkan (bukan setState dalam effect): jika pilihan tak wujud untuk kurma ini → berat pertama
  const effWeight = weights.includes(weight) ? weight : (weights[0] ?? '')
  const q = Math.max(1, Math.floor(Number(qty) || 0))
  const row = useMemo(() => findSheetRow(sheet, kurma, effWeight, q), [sheet, kurma, effWeight, q])
  const tiers = useMemo(() => sheetTiers(sheet, kurma, effWeight), [sheet, kurma, effWeight])
  const band = sheet && q ? bandFor(sheet, q) : null

  // Pecahan kos: nilai Sheet sebagai asas, override pengguna menang. Komisyen = 2% harga (auto) kecuali diubah.
  const rowKey = row ? `${row.kurma}|${row.weight}|${row.qty}` : ''
  const vals = ov.key === rowKey ? ov.vals : {}
  const setVal = (k: string, v: string) => setOv({ key: rowKey, vals: { ...vals, [k]: v } })
  const COMPONENTS: { k: keyof GiftCostSheet['rows'][number]['cost']; label: string }[] = [
    { k: 'kurma', label: 'Kos Kurma' }, { k: 'ziplock', label: 'Kos Ziplock' }, { k: 'upah', label: 'Kos Upah' }, { k: 'lain', label: 'Kos Lain-Lain' }, { k: 'kotak', label: 'Kos Kotak' },
  ]
  const comp = (k: keyof GiftCostSheet['rows'][number]['cost']) => vals[k] !== undefined && vals[k] !== '' && Number.isFinite(Number(vals[k])) ? Number(vals[k]) : (row?.cost[k] ?? 0)
  const costExKom = r2(COMPONENTS.reduce((t, c) => t + comp(c.k), 0))
  const komOverride = vals.komisyen !== undefined && vals.komisyen !== '' && Number.isFinite(Number(vals.komisyen)) ? Number(vals.komisyen) : null
  const KOM_RATE = 0.02
  // Harga akhir: harga anda > margin sasaran > harga Sheet. Komisyen auto 2% harga → selesaikan secara algebra dalam mod margin.
  let finalPrice: number
  if (price !== '' && Number(price) > 0) finalPrice = r2(Number(price))
  else if (margin !== '' && Number.isFinite(Number(margin))) {
    const m = Number(margin) / 100
    finalPrice = komOverride !== null ? priceForMargin(costExKom + komOverride, Number(margin)) : (1 - m - KOM_RATE > 0 ? r2(costExKom / (1 - m - KOM_RATE)) : 0)
  } else finalPrice = row?.price ?? 0
  const komisyen = komOverride !== null ? r2(komOverride) : r2(finalPrice * KOM_RATE)
  const cost = r2(costExKom + komisyen)
  const finalMargin = marginPct(finalPrice, cost)
  const profitUnit = r2(finalPrice - cost)
  const touched = Object.values(vals).some(v => v !== '') || margin !== '' || price !== ''

  if (loading) return <div className="py-6 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
  if (!sheet) return <p className="text-xs text-gray-500">Sheet harga belum ditarik. Buka <b>Kos &amp; Harga → Tarik dari Sheet</b> dahulu.</p>

  return (
    <div className={compact ? '' : 'space-y-3'}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div><label className={lbl}>Kurma</label><select value={kurma} onChange={e => { setKurma(e.target.value); setWeight('') }} className={inp}>{sheet.kurma.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
        <div><label className={lbl}>Berat</label><select value={effWeight} onChange={e => setWeight(e.target.value)} className={inp}>{weights.map(w => <option key={w} value={w}>{w}</option>)}</select></div>
        <div><label className={lbl}>Kuantiti (kotak)</label><input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className={`${inp} font-mono`} /></div>
        <div><label className={lbl}>Margin sasaran %</label><input type="number" min="0" max="95" step="1" value={margin} onChange={e => { setMargin(e.target.value); setPrice('') }} placeholder={row ? String(row.margin_pct) : '—'} className={`${inp} font-mono`} /></div>
      </div>

      {row ? (
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start mt-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            {/* Pecahan kos (nama lajur sama seperti Sheet) — boleh ubah untuk cuba-cuba */}
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Pecahan kos / kotak <span className="font-normal normal-case tracking-normal text-gray-400">tier @{row.qty.toLocaleString('en-MY')} · ubah mana-mana untuk cuba</span></p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {COMPONENTS.map(c => (
                <div key={c.k}>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5 truncate">{c.label}</label>
                  <input type="number" min="0" step="0.01" value={vals[c.k] ?? ''} onChange={e => setVal(c.k, e.target.value)} placeholder={row.cost[c.k].toFixed(2)} className={`${inp} font-mono text-right px-2 ${vals[c.k] ? 'border-gray-900' : ''}`} aria-label={c.label} />
                  <p className="text-[10px] text-gray-400 text-right mt-0.5">Sheet {row.cost[c.k].toFixed(2)}</p>
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5 truncate">Kos komisyen</label>
                <input type="number" min="0" step="0.01" value={vals.komisyen ?? ''} onChange={e => setVal('komisyen', e.target.value)} placeholder={komisyen.toFixed(2)} className={`${inp} font-mono text-right px-2 ${vals.komisyen ? 'border-gray-900' : ''}`} aria-label="Kos komisyen" />
                <p className="text-[10px] text-gray-400 text-right mt-0.5">{komOverride !== null ? `Sheet ${row.cost.komisyen.toFixed(2)}` : '2% harga'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-sm mt-3 pt-3 border-t border-gray-200">
              <div><p className="text-[11px] text-gray-500">Kos / kotak <span className="text-gray-400">{cost !== row.total_cost ? `Sheet ${rm(row.total_cost)}` : ''}</span></p><p className={`font-mono font-semibold ${cost !== row.total_cost ? 'text-gray-900' : ''}`}>{rm(cost)}</p></div>
              <div><p className="text-[11px] text-gray-500">Harga Sheet</p><p className="font-mono font-semibold">{rm(row.price)} <span className={`text-[11px] ${marginCls(row.margin_pct)}`}>{row.margin_pct.toFixed(1)}%</span></p></div>
              <div><p className="text-[11px] text-gray-500">Harga anda / kotak</p><div className="flex items-center gap-1"><span className="text-xs text-gray-500">RM</span><input type="number" min="0" step="0.10" value={price} onChange={e => { setPrice(e.target.value); setMargin('') }} placeholder={finalPrice.toFixed(2)} className={`${inp} font-mono w-28`} /></div></div>
              <div><p className="text-[11px] text-gray-500">Margin harga anda</p><p className={`font-mono font-bold text-lg ${marginCls(finalMargin)}`}>{finalMargin.toFixed(1)}%</p></div>
            </div>
            <div className="grid grid-cols-3 gap-x-3 mt-3 pt-3 border-t border-gray-200 text-sm">
              <div><p className="text-[11px] text-gray-500">Untung / kotak</p><p className={`font-mono font-semibold ${profitUnit < 0 ? 'text-red-700' : ''}`}>{rm(profitUnit)}</p></div>
              <div><p className="text-[11px] text-gray-500">Jumlah untung × {q.toLocaleString('en-MY')}</p><p className={`font-mono font-semibold ${profitUnit < 0 ? 'text-red-700' : ''}`}>{rm(r2(profitUnit * q))}</p></div>
              <div><p className="text-[11px] text-gray-500">Jumlah jualan</p><p className="font-mono font-semibold">{rm(r2(finalPrice * q))}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-gray-500">
              <span>Tier Sheet: {tiers.map(t => `@${t.qty.toLocaleString('en-MY')} ${rm(t.price)}`).join(' · ')}</span>
              {band && <span className={finalMargin < Number(band.margin_label.match(/\d+/)?.[0] ?? 0) ? 'text-amber-700 font-semibold' : ''}>Panduan {band.qty_label}: margin {band.margin_label}</span>}
              <span>Kos = jumlah pecahan di atas; komisyen 2% dari harga ikut Sheet. Ubah mana-mana kos untuk cuba senario (kotak lebih murah, upah lain).</span>
            </div>
          </div>
          <div className="flex sm:flex-col gap-2">
            {onUse && <button type="button" onClick={() => onUse({ name: sheetItemName(row), description: `${row.kurma} ${row.weight} · ${q.toLocaleString('en-MY')} kotak · margin ${finalMargin.toFixed(0)}%${cost !== row.total_cost ? ` · kos ubah RM${cost.toFixed(2)}` : ''}`, qty: q, unit: 'box', rate: finalPrice })} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 whitespace-nowrap"><Plus className="h-4 w-4" />Tambah ke item</button>}
            <button type="button" onClick={() => { setMargin(''); setPrice(''); setOv({ key: '', vals: {} }) }} disabled={!touched} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 whitespace-nowrap disabled:opacity-40"><RefreshCw className="h-4 w-4" />Ikut Sheet</button>
          </div>
        </div>
      ) : <p className="text-xs text-gray-500 mt-3 inline-flex items-center gap-1"><Calculator className="h-3.5 w-3.5" />Tiada baris Sheet untuk kombinasi ini.</p>}
    </div>
  )
}
