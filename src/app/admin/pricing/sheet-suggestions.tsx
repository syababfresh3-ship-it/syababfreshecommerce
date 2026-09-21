'use client'

// Panel "Cost Suggestions from Sheet" — tekan Check untuk baca Google Sheet invois,
// papar cadangan kos landed terkini, admin tekan Apply/Ignore. Cadang & sahkan.
//
// 21 Sep 2026: checkbox + tindakan pukal. Dulu 43 cadangan = 43 klik. Kini tanda
// baris (atau "Select all") → Apply/Ignore sekali gus. Tindakan pukal HANYA bila
// ada yang ditanda — tiada fallback "tiada tanda = semua". Apply pukal minta
// pengesahan sebab ia menulis kos ke variant_costs. UI English selaras admin lain;
// medan data (nama, kos_buah_lama, …) kekal — itu kontrak dengan page.tsx.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X, Loader2 } from 'lucide-react'

export interface SuggestionRow {
  id: string
  nama: string
  variantNama: string | null
  kos_buah_lama: number | null
  kos_buah_baru: number
  cfr: number
  clearance: number
  rule: string
  tarikh: string
}

export interface ScanReport {
  cadangan: number
  dilangkau: number
  baris_sheet: number
  skipped: { apa: string; sebab: string }[]
}

type Action = 'apply' | 'ignore'
const rm = (n: number) => `RM${n.toFixed(2)}`

export function SheetSuggestions({ suggestions }: { suggestions: SuggestionRow[] }) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [bulkBusy, setBulkBusy] = useState<Action | null>(null)
  // Laporan scan terakhir — supaya "0 suggestions" ada sebab yang boleh dibaca.
  const [laporan, setLaporan] = useState<ScanReport | null>(null)
  const [bukaLaporan, setBukaLaporan] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Senarai berubah selepas refresh → buang pilihan yang dah tak wujud.
  useEffect(() => {
    const live = new Set(suggestions.map((s) => s.id))
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => live.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [suggestions])

  const allSelected = suggestions.length > 0 && suggestions.every((s) => selected.has(s.id))
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(suggestions.map((s) => s.id)))
  const selectedCount = useMemo(() => [...selected].filter((id) => suggestions.some((s) => s.id === id)).length, [selected, suggestions])

  async function scan() {
    setScanning(true)
    try {
      const res = await fetch('/api/admin/pricing/sheet-scan', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to check sheet')
      toast.success(`${json.cadangan} suggestions · ${json.dilangkau} skipped (${json.baris_sheet} sheet rows)`)
      setLaporan({
        cadangan: Number(json.cadangan ?? 0),
        dilangkau: Number(json.dilangkau ?? 0),
        baris_sheet: Number(json.baris_sheet ?? 0),
        skipped: Array.isArray(json.skipped) ? json.skipped : [],
      })
      setBukaLaporan(json.cadangan === 0) // 0 suggestions → open the reasons right away
      setSelected(new Set())
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to check sheet')
    } finally {
      setScanning(false)
    }
  }

  async function resolveOne(id: string, action: Action) {
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      const res = await fetch('/api/admin/pricing/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      toast.success(action === 'apply' ? 'Cost updated' : 'Suggestion ignored')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  async function resolveBulk(action: Action) {
    const ids = suggestions.filter((s) => selected.has(s.id)).map((s) => s.id)
    if (!ids.length) return
    if (action === 'apply' && !window.confirm(`Apply ${ids.length} suggestion${ids.length > 1 ? 's' : ''}? Costs will be written to variant costs.`)) return
    setBulkBusy(action)
    try {
      const res = await fetch('/api/admin/pricing/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      const done = Number(json.done ?? 0)
      const failed: { id: string; error: string }[] = Array.isArray(json.failed) ? json.failed : []
      const verb = action === 'apply' ? 'applied' : 'ignored'
      if (failed.length === 0) toast.success(`${done} ${verb}`)
      else toast.warning(`${done} ${verb} · ${failed.length} failed — ${failed[0].error}`)
      setSelected(new Set())
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBulkBusy(null)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Cost Suggestions from Sheet</h2>
          <p className="text-[12px] text-gray-500">
            Latest landed costs from the Google Sheet invoices. Confirm each suggestion — costs only change when you press Apply.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-[13px] font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {scanning ? 'Checking…' : 'Check Costs from Sheet'}
        </button>
      </div>

      {laporan && (
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-gray-600">
              Last scan: <span className="font-semibold text-gray-900">{laporan.cadangan} suggestions</span>
              {' · '}{laporan.dilangkau} skipped{' · '}{laporan.baris_sheet} sheet rows read
            </p>
            {laporan.skipped.length > 0 && (
              <button
                onClick={() => setBukaLaporan((b) => !b)}
                className="text-[12px] font-semibold text-blue-600 hover:underline"
              >
                {bukaLaporan ? 'Hide reasons' : `Why skipped? (${laporan.skipped.length})`}
              </button>
            )}
          </div>
          {bukaLaporan && laporan.skipped.length > 0 && (
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
              {laporan.skipped.map((s, i) => (
                <li key={i} className="text-[12px] text-gray-600">
                  <span className="font-semibold text-gray-800">{s.apa}</span> — {s.sebab}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {suggestions.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-gray-500">
          No suggestions right now. Press <span className="font-semibold">Check Costs from Sheet</span> to read the latest costs.
        </p>
      ) : (
        <>
          {/* Baris pilih-semua + bar pukal (hanya bila ada yang ditanda) */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50/60">
            <label className="flex items-center gap-2 text-[12px] text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded text-gray-800 focus:ring-gray-400" />
              Select all ({suggestions.length})
            </label>
            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-800 tabular-nums">{selectedCount} selected</span>
                <button
                  onClick={() => resolveBulk('apply')}
                  disabled={bulkBusy !== null}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {bulkBusy === 'apply' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Apply {selectedCount}
                </button>
                <button
                  onClick={() => resolveBulk('ignore')}
                  disabled={bulkBusy !== null}
                  className="flex items-center gap-1 rounded-lg bg-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                >
                  {bulkBusy === 'ignore' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Ignore {selectedCount}
                </button>
                <button onClick={() => setSelected(new Set())} className="text-[12px] text-gray-500 hover:text-gray-800 underline">Clear</button>
              </div>
            )}
          </div>

          <ul className="divide-y divide-gray-100">
            {suggestions.map((s) => {
              const naik = s.kos_buah_lama != null && s.kos_buah_baru > s.kos_buah_lama
              const turun = s.kos_buah_lama != null && s.kos_buah_baru < s.kos_buah_lama
              const sel = selected.has(s.id)
              return (
                <li key={s.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${sel ? 'bg-gray-50' : ''}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <input type="checkbox" checked={sel} onChange={() => toggleOne(s.id)} className="mt-1 rounded text-gray-800 focus:ring-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900">
                        {s.nama}
                        {s.variantNama ? <span className="font-normal text-gray-500"> · {s.variantNama}</span> : null}
                      </p>
                      <p className="text-[12px] text-gray-600">
                        <span className="text-gray-400">{s.kos_buah_lama != null ? rm(s.kos_buah_lama) : '(none)'}</span>
                        {' → '}
                        <span className={`font-bold ${naik ? 'text-red-600' : turun ? 'text-green-600' : 'text-gray-900'}`}>
                          {rm(s.kos_buah_baru)}
                        </span>
                        <span className="ml-2 text-gray-400">
                          ({s.rule}: CFR {rm(s.cfr)}{s.clearance > 0 ? ` + clearance ${rm(s.clearance)}` : ''} · {s.tarikh})
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => resolveOne(s.id, 'apply')}
                      disabled={busy[s.id] || bulkBusy !== null}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => resolveOne(s.id, 'ignore')}
                      disabled={busy[s.id] || bulkBusy !== null}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                    >
                      Ignore
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
