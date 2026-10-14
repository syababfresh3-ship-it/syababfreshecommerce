'use client'

// Tetapan kos Custom Gift Box Kurma — kotak ikut tier qty per berat (bentuk sama dgn sheet jualan),
// kurma RM/kg ikut gred, packing & hantar per kotak, margin sasaran. Disimpan sebagai JSON di
// app_settings.gift_cost_config (GET/PATCH /api/admin/settings/gift-cost). "Semak pantas" tunjuk
// harga senarai vs kos → untung/margin supaya staf nampak kesan angka yang diisi.
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, AlertTriangle } from 'lucide-react'
import { KURMA, SHEET_WEIGHTS, QTY_PRESETS, sheetQuote, rm, type SheetWeight } from '@/lib/gift-pricing'
import { EMPTY_GIFT_COST, costUnitFor, marginFor, costStatusOf, priceForMargin, missingCostFields, type GiftCostConfig } from '@/lib/gift-cost'

const box = 'bg-white border border-gray-200 rounded-2xl p-4'
const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const lbl = 'block text-[11px] font-bold text-gray-500 mb-1'
const STATUS_CLS: Record<string, string> = { bahaya: 'bg-red-50 text-red-700', perhatian: 'bg-amber-50 text-amber-700', sihat: 'bg-green-50 text-green-700' }

type BoxText = Record<SheetWeight, Record<number, string>>
const emptyBoxText = (): BoxText => ({ '100g': {}, '200g': {}, '500g': {} })

function cfgToText(cfg: GiftCostConfig) {
  const boxText = emptyBoxText()
  for (const w of SHEET_WEIGHTS) for (const [q, v] of Object.entries(cfg.box[w] ?? {})) boxText[w][Number(q)] = String(v)
  const kurmaText: Record<string, string> = {}
  for (const [id, v] of Object.entries(cfg.kurma_per_kg)) kurmaText[id] = String(v)
  return { boxText, kurmaText, packing: String(cfg.packing_per_box), delivery: String(cfg.delivery_per_box), margin: String(cfg.default_margin_pct) }
}
function textToCfg(boxText: BoxText, kurmaText: Record<string, string>, packing: string, delivery: string, margin: string): GiftCostConfig {
  const out: GiftCostConfig = { ...EMPTY_GIFT_COST, box: {}, kurma_per_kg: {} }
  for (const w of SHEET_WEIGHTS) {
    const tiers: Record<number, number> = {}
    for (const [q, v] of Object.entries(boxText[w])) { const n = Number(v); if (v !== '' && Number.isFinite(n) && n >= 0) tiers[Number(q)] = n }
    if (Object.keys(tiers).length) out.box[w] = tiers
  }
  for (const [id, v] of Object.entries(kurmaText)) { const n = Number(v); if (v !== '' && Number.isFinite(n) && n >= 0) out.kurma_per_kg[id] = n }
  out.packing_per_box = Math.max(0, Number(packing) || 0)
  out.delivery_per_box = Math.max(0, Number(delivery) || 0)
  const m = Number(margin); out.default_margin_pct = Number.isFinite(m) ? Math.min(95, Math.max(0, m)) : 30
  return out
}

export function CostsClient() {
  const [loading, setLoading] = useState(true)
  const [exists, setExists] = useState(false)
  const [saving, setSaving] = useState(false)
  const [boxText, setBoxText] = useState<BoxText>(emptyBoxText())
  const [kurmaText, setKurmaText] = useState<Record<string, string>>({})
  const [packing, setPacking] = useState('0')
  const [delivery, setDelivery] = useState('0')
  const [margin, setMargin] = useState('30')
  // Semak pantas
  const [qk, setQk] = useState(KURMA[0].id)
  const [qw, setQw] = useState<SheetWeight>('200g')
  const [qq, setQq] = useState(100)

  useEffect(() => {
    fetch('/api/admin/settings/gift-cost').then(r => r.json()).then(j => {
      const t = cfgToText(j?.config ?? EMPTY_GIFT_COST)
      setBoxText(t.boxText); setKurmaText(t.kurmaText); setPacking(t.packing); setDelivery(t.delivery); setMargin(t.margin)
      setExists(!!j?.exists)
    }).catch(() => toast.error('Gagal muat tetapan')).finally(() => setLoading(false))
  }, [])

  const cfg = useMemo(() => textToCfg(boxText, kurmaText, packing, delivery, margin), [boxText, kurmaText, packing, delivery, margin])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/gift-cost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal simpan'); return }
      setExists(true); toast.success('Kos disimpan')
    } finally { setSaving(false) }
  }

  // Semak pantas
  const list = sheetQuote({ kurmaId: qk, weight: qw, qty: qq })
  const cost = costUnitFor(cfg, { kurmaId: qk, weight: qw, qty: list.ok ? list.qty : qq })
  const m = list.ok && cost ? marginFor(list.perBox, cost.total) : null
  const status = m && cost ? costStatusOf(m.untung, m.pct, cfg.default_margin_pct) : null
  const suggest = cost ? priceForMargin(cost.total, cfg.default_margin_pct) : null

  if (loading) return <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gift Studio — Kos & Harga</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kos sebenar per kotak untuk kira margin dalam sebut harga. Harga jual (senarai) kekal dari sheet 2026 di <code className="bg-gray-100 px-1 rounded">lib/gift-pricing.ts</code>.</p>
      </div>

      {!exists && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />Kos belum diisi — panel sebut harga di setiap order akan tunjuk "Isi kos dulu" sehingga disimpan.
        </div>
      )}

      {/* Kos kotak ikut tier */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">Kos kotak (RM/kotak) — cetak + kotak, ikut kuantiti</p>
        <p className="text-[12px] text-gray-500 mb-3">Isi tier yang ada sahaja; kosong = tiada tier (cth 500g bermula 500). Tier terbesar ≤ kuantiti order yang dipakai.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs"><tr><th className="text-left px-3 py-2">Berat</th>{QTY_PRESETS.map(q => <th key={q} className="text-right px-2 py-2 tabular-nums">{q}+</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {SHEET_WEIGHTS.map(w => (
                <tr key={w}>
                  <td className="px-3 py-2 font-semibold text-gray-800">{w}</td>
                  {QTY_PRESETS.map(q => (
                    <td key={q} className="px-1.5 py-1.5">
                      <input type="number" step="0.01" min="0" aria-label={`Kos kotak ${w} tier ${q}`} value={boxText[w][q] ?? ''} placeholder="—"
                        onChange={e => setBoxText(b => ({ ...b, [w]: { ...b[w], [q]: e.target.value } }))} className={`${inp} w-20 text-right font-mono`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kos kurma */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Kos kurma (RM/kg) ikut gred — auto kira ikut berat kotak</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {KURMA.map(k => (
            <div key={k.id}><label className={lbl}>{k.name}</label><input type="number" step="0.01" min="0" value={kurmaText[k.id] ?? ''} placeholder="RM/kg" onChange={e => setKurmaText(t => ({ ...t, [k.id]: e.target.value }))} className={`${inp} w-full font-mono`} /></div>
          ))}
        </div>
      </div>

      {/* Lain-lain */}
      <div className={box}>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lbl}>Packing / kotak (RM)</label><input type="number" step="0.01" min="0" value={packing} onChange={e => setPacking(e.target.value)} className={`${inp} w-full font-mono`} /></div>
          <div><label className={lbl}>Hantar / kotak (RM)</label><input type="number" step="0.01" min="0" value={delivery} onChange={e => setDelivery(e.target.value)} className={`${inp} w-full font-mono`} /></div>
          <div><label className={lbl}>Margin sasaran (%)</label><input type="number" step="1" min="0" max="95" value={margin} onChange={e => setMargin(e.target.value)} className={`${inp} w-full font-mono`} /></div>
        </div>
        <button onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Simpan kos
        </button>
      </div>

      {/* Semak pantas */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Semak pantas — senarai vs kos (ikut angka di atas, belum simpan pun dikira)</p>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className={lbl}>Kurma</label><select value={qk} onChange={e => setQk(e.target.value)} className={inp}>{KURMA.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></div>
          <div><label className={lbl}>Berat</label><select value={qw} onChange={e => setQw(e.target.value as SheetWeight)} className={inp}>{SHEET_WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}</select></div>
          <div><label className={lbl}>Kuantiti</label><input type="number" min="1" value={qq} onChange={e => setQq(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className={`${inp} w-24 font-mono`} /></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-[11px] font-bold text-gray-500">Harga senarai</div>
            <div className="text-lg font-black text-gray-900 tabular-nums">{list.ok ? rm(list.perBox) : '—'}<span className="text-xs font-semibold text-gray-400">/kotak</span></div>
            {list.ok && <div className="text-[11px] text-gray-500">× {list.qty} = {rm(list.total)}{list.clamped ? ` (min ${list.minTier})` : ''}</div>}
            {!list.ok && <div className="text-[11px] text-gray-500">{list.error}</div>}
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-[11px] font-bold text-gray-500">Kos</div>
            {cost ? (
              <>
                <div className="text-lg font-black text-gray-900 tabular-nums">{rm(cost.total)}<span className="text-xs font-semibold text-gray-400">/kotak</span></div>
                <div className="text-[11px] text-gray-500">kotak {rm(cost.box)} · kurma {rm(cost.kurma)} · packing {rm(cost.packing)} · hantar {rm(cost.delivery)}</div>
              </>
            ) : <div className="text-[12px] text-amber-700">Isi dulu: {missingCostFields(cfg, { kurmaId: qk, weight: qw, qty: qq }).join(', ')}</div>}
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-[11px] font-bold text-gray-500">Untung @ senarai</div>
            {m && status ? (
              <>
                <div className="text-lg font-black tabular-nums text-gray-900">{rm(m.untung)} <span className="text-xs font-semibold text-gray-400">({m.pct.toFixed(1)}%)</span></div>
                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[status]}`}>{status}</span>
                {suggest !== null && <div className="text-[11px] text-gray-500 mt-1">Cadangan @ {cfg.default_margin_pct}%: {rm(suggest)}/kotak</div>}
              </>
            ) : <div className="text-[12px] text-gray-400">—</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
