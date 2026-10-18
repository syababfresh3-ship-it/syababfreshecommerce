'use client'

// Kalkulator untung ejen/stokis — harga ejen/stokis dari fail pemilik, SRP = srp fail atau harga varian DB.
import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { rm, AGENT_PROGRAM } from '@/lib/borong-pricing'
import type { AgentRow } from '@/lib/borong-data'
import { useBorong } from './borong-context'

const QTY = [20, 50, 100, 200]

export function ProfitCalculator({ rows }: { rows: AgentRow[] }) {
  const { setSegment } = useBorong()
  const [slug, setSlug] = useState(rows[0]?.slug ?? '')
  const row = rows.find(r => r.slug === slug) ?? rows[0]
  const tiers = AGENT_PROGRAM.tiers.filter(t => (t.id === 'ejen' ? row?.agentPrice : row?.stokisPrice) != null)
  const [tier, setTier] = useState<'ejen' | 'stokis'>(tiers[0]?.id ?? 'ejen')
  const [qty, setQty] = useState(50)
  const tierPrice = tier === 'ejen' ? row?.agentPrice ?? null : row?.stokisPrice ?? null
  const calc = useMemo(() => {
    if (!row || tierPrice == null || row.srp == null) return null
    const profit = row.srp - tierPrice
    return { profit, pct: (profit / row.srp) * 100, monthly: profit * qty, capital: tierPrice * qty }
  }, [row, tierPrice, qty])
  if (!row) return null
  const inp = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
  return (
    <div id="kira-untung" className="rounded-3xl border border-gray-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-5 scroll-mt-16 md:scroll-mt-24">
      <h3 className="text-lg font-black text-gray-900">Kira untung anda</h3>
      <p className="text-[13px] text-gray-500">Anggaran per pek — belum tolak kos hantar/pembungkusan anda.</p>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <label className="text-[12px] font-semibold text-gray-600">Produk<select value={slug} onChange={e => { setSlug(e.target.value); setTier('ejen') }} className={`${inp} w-full mt-1`}>{rows.map(r => <option key={r.slug} value={r.slug}>{r.name} · {r.pack}</option>)}</select></label>
        <div className="text-[12px] font-semibold text-gray-600">Tier
          <div className="flex gap-2 mt-1" role="group" aria-label="Tier">
            {tiers.map(t => <button key={t.id} type="button" aria-pressed={tier === t.id} onClick={() => setTier(t.id)} className={`px-3 py-2 rounded-xl border text-sm font-bold ${tier === t.id ? 'text-white' : 'bg-white text-gray-700 border-gray-200'}`} style={tier === t.id ? { background: '#1F2937', borderColor: '#1F2937' } : undefined}>{t.label}</button>)}
          </div>
        </div>
        <div className="text-[12px] font-semibold text-gray-600">Pek / bulan
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {QTY.map(q => <button key={q} type="button" aria-pressed={qty === q} onClick={() => setQty(q)} className={`px-2.5 py-2 rounded-lg border text-sm font-bold ${qty === q ? 'text-white' : 'bg-white text-gray-700 border-gray-200'}`} style={qty === q ? { background: '#1F2937', borderColor: '#1F2937' } : undefined}>{q}</button>)}
            <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} aria-label="Pek sebulan" className={`${inp} w-20 text-center font-black`} />
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-sm">
        <div className="rounded-xl bg-gray-50 p-3"><dt className="text-[11px] font-bold text-gray-500">Harga {tier}</dt><dd className="font-black text-gray-900 tabular-nums">{tierPrice != null ? rm(tierPrice) : '—'}</dd></div>
        <div className="rounded-xl bg-gray-50 p-3"><dt className="text-[11px] font-bold text-gray-500">Harga runcit cadangan</dt><dd className="font-black text-gray-900 tabular-nums">{row.srp != null ? rm(row.srp) : 'minta'}</dd></div>
        <div className="rounded-xl bg-gray-50 p-3"><dt className="text-[11px] font-bold text-gray-500">Untung / pek</dt><dd className="font-black text-gray-900 tabular-nums">{calc && calc.profit > 0 ? `${rm(calc.profit)} (${calc.pct.toFixed(0)}%)` : calc ? 'Semak harga' : '—'}</dd></div>
        <div className="rounded-xl bg-[#FDECEC] p-3"><dt className="text-[11px] font-bold text-gray-500">Untung / bulan</dt><dd className="font-black text-gray-900 tabular-nums">{calc && calc.profit > 0 ? rm(calc.monthly) : '—'}</dd><dd className="text-[11px] text-gray-500">modal {calc ? rm(calc.capital) : '—'}</dd></div>
      </dl>
      {AGENT_PROGRAM.srpNote && <p className="text-[11px] text-gray-400 mt-2">{AGENT_PROGRAM.srpNote}</p>}
      <button type="button" onClick={() => { setSegment('ejen'); document.getElementById('mohon')?.scrollIntoView({ behavior: 'smooth' }) }} className="mt-4 inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl text-white font-bold" style={{ background: '#E11D2A' }}>Mohon jadi ejen <ChevronRight className="h-5 w-5" /></button>
    </div>
  )
}
