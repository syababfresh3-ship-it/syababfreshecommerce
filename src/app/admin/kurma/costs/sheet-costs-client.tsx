'use client'

// Rujukan kos & harga gift box dari Google Sheet "GIFT BOX CUSTOM 2026" (pemilik 25 Okt 2026:
// team sale ubah di sheet sahaja). Butang "Tarik dari Sheet" → simpan ke app_settings; jadual
// ikut kurma → berat → tier qty: kos/kotak, harga, untung, margin. Dipakai cadangan item sebut harga.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, ExternalLink, Table2 } from 'lucide-react'
import { GIFT_COST_SHEET_EDIT_URL, type GiftCostSheet } from '@/lib/gift-cost-sheet'

const rm = (n: number) => `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDT = (v: string | null | undefined) => v ? new Date(v).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const MARGIN_CLS = (p: number) => p >= 40 ? 'text-green-700' : p >= 30 ? 'text-amber-700' : 'text-red-700'

export function SheetCostsClient() {
  const [sheet, setSheet] = useState<GiftCostSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/settings/gift-cost-sheet')
    const j = await res.json().catch(() => ({}))
    setSheet(j.sheet ?? null); setLoading(false)
  }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  async function pull() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/settings/gift-cost-sheet', { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal tarik sheet'); return }
      setSheet(j.sheet)
      const d = j.diff ?? {}
      toast.success(`Sheet ditarik: ${j.sheet?.rows?.length ?? 0} baris (${d.added ?? 0} baharu, ${d.changed ?? 0} berubah, ${d.removed ?? 0} dibuang)`)
    } finally { setBusy(false) }
  }

  const groups = useMemo(() => {
    if (!sheet) return []
    return sheet.kurma.map(k => ({ kurma: k, rows: sheet.rows.filter(r => r.kurma === k) }))
  }, [sheet])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 inline-flex items-center gap-1.5"><Table2 className="h-3.5 w-3.5" />Sheet &quot;GIFT BOX CUSTOM 2026&quot; — rujukan harga team sale</p>
          <p className="text-xs text-gray-500 mt-1">{loading ? 'Memuat…' : sheet ? `${sheet.rows.length} baris · ${sheet.kurma.length} jenis kurma · ditarik ${fmtDT(sheet.fetched_at)}` : 'Belum ditarik. Tekan butang untuk ambil dari Google Sheet.'} Ubah angka di Sheet, kemudian tarik semula di sini.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={GIFT_COST_SHEET_EDIT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"><ExternalLink className="h-4 w-4" />Buka Sheet</a>
          <button type="button" onClick={pull} disabled={busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Tarik dari Sheet</button>
        </div>
      </div>

      {sheet && sheet.bands.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {sheet.bands.map((b, i) => <span key={i} className="text-[11px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">{b.qty_label}: margin sasaran {b.margin_label}</span>)}
        </div>
      )}

      {sheet && (
        <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
          {groups.map(g => {
            const isOpen = open === g.kurma || open === '*'
            return (
              <div key={g.kurma}>
                <button type="button" onClick={() => setOpen(isOpen && open !== '*' ? null : g.kurma)} className="w-full flex items-center justify-between py-2.5 text-left">
                  <span className="text-sm font-bold text-gray-900">{g.kurma}</span>
                  <span className="text-xs text-gray-500">{[...new Set(g.rows.map(r => r.weight))].join(' · ')} · {g.rows.length} tier</span>
                </button>
                {isOpen && (
                  <div className="overflow-x-auto pb-3">
                    <table className="w-full text-xs min-w-[560px]">
                      <thead className="text-gray-500"><tr><th className="text-left font-semibold py-1 pr-2">Berat</th><th className="text-right font-semibold py-1 pr-2">Qty</th><th className="text-right font-semibold py-1 pr-2">Kurma</th><th className="text-right font-semibold py-1 pr-2">Kotak</th><th className="text-right font-semibold py-1 pr-2">Lain</th><th className="text-right font-semibold py-1 pr-2">Kos/kotak</th><th className="text-right font-semibold py-1 pr-2">Harga</th><th className="text-right font-semibold py-1 pr-2">Untung</th><th className="text-right font-semibold py-1">Margin</th></tr></thead>
                      <tbody>
                        {g.rows.map((r, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="py-1 pr-2 font-semibold text-gray-800">{r.weight}</td>
                            <td className="py-1 pr-2 text-right font-mono">{r.qty.toLocaleString('en-MY')}</td>
                            <td className="py-1 pr-2 text-right font-mono text-gray-600">{rm(r.cost.kurma)}</td>
                            <td className="py-1 pr-2 text-right font-mono text-gray-600">{rm(r.cost.kotak)}</td>
                            <td className="py-1 pr-2 text-right font-mono text-gray-600">{rm(r.cost.ziplock + r.cost.upah + r.cost.lain + r.cost.komisyen)}</td>
                            <td className="py-1 pr-2 text-right font-mono font-semibold">{rm(r.total_cost)}</td>
                            <td className="py-1 pr-2 text-right font-mono font-bold text-gray-900">{rm(r.price)}</td>
                            <td className="py-1 pr-2 text-right font-mono">{rm(r.profit)}</td>
                            <td className={`py-1 text-right font-mono font-semibold ${MARGIN_CLS(r.margin_pct)}`}>{r.margin_pct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
          <div className="pt-2"><button type="button" onClick={() => setOpen(open === '*' ? null : '*')} className="text-xs font-semibold text-gray-600 hover:text-gray-900">{open === '*' ? 'Tutup semua' : 'Buka semua'}</button></div>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-3">Baris sheet muncul sebagai cadangan item dalam sebut harga (&quot;Custom Gift Box 200g — Mariami A&quot;) dengan harga ikut tier kuantiti. Jadual kos manual di bawah kekal sebagai sandaran.</p>
    </div>
  )
}
