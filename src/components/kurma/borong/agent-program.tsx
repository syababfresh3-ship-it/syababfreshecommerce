import { AGENT_PROGRAM, hasAgentProgram, rm } from '@/lib/borong-pricing'
import type { AgentRow } from '@/lib/borong-data'
import { ProfitCalculator } from './profit-calculator'

// Program ejen/stokis — hanya bila AGENT_PROGRAM.enabled & ada harga ejen/stokis dalam katalog.
export function AgentProgram({ rows }: { rows: AgentRow[] }) {
  if (!hasAgentProgram() || !rows.length) return null
  return (
    <section id="ejen" className="max-w-5xl mx-auto px-4 pb-14 scroll-mt-16">
      <h2 className="text-2xl font-black text-gray-900 text-center text-balance">Jadi ejen atau stokis</h2>
      <p className="text-gray-500 text-center mt-2 text-sm max-w-xl mx-auto">Beli pada harga ejen, jual sendiri, simpan margin penuh — bukan program affiliate pautan.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-7">
        {AGENT_PROGRAM.tiers.map(t => (
          <div key={t.id} className="rounded-2xl border border-gray-200 p-5 bg-white">
            <div className="font-black text-gray-900 text-lg">{t.label}</div>
            <div className="text-[13px] text-gray-500 mt-1">{t.how}</div>
            {(t.minCtn != null || t.minRm != null) && <div className="text-sm font-semibold text-gray-800 mt-2">Minimum: {t.minCtn != null ? `${t.minCtn} karton` : rm(t.minRm!)}</div>}
            {t.perks.length > 0 && <ul className="text-[13px] text-gray-600 mt-2 space-y-1 list-disc pl-4">{t.perks.map(p => <li key={p}>{p}</li>)}</ul>}
          </div>
        ))}
      </div>
      <div className="mt-6"><ProfitCalculator rows={rows} /></div>
    </section>
  )
}
