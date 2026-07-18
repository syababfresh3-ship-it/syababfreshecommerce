'use client'

// Panel "Cadangan Kos dari Sheet" — tekan Semak untuk baca Google Sheet invois,
// papar cadangan kos landed terkini, admin tekan Guna/Abai. Cadang & sahkan.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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

const rm = (n: number) => `RM${n.toFixed(2)}`

export function SheetSuggestions({ suggestions }: { suggestions: SuggestionRow[] }) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  async function scan() {
    setScanning(true)
    try {
      const res = await fetch('/api/admin/pricing/sheet-scan', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal semak sheet')
      toast.success(`${json.cadangan} cadangan · ${json.dilangkau} dilangkau (${json.baris_sheet} baris sheet)`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal semak sheet')
    } finally {
      setScanning(false)
    }
  }

  async function resolve(id: string, action: 'apply' | 'ignore') {
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      const res = await fetch('/api/admin/pricing/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal')
      toast.success(action === 'apply' ? 'Kos dikemas kini' : 'Cadangan diabaikan')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Cadangan Kos dari Sheet</h2>
          <p className="text-[12px] text-gray-500">
            Kos landed terkini dari Google Sheet invois. Sahkan setiap cadangan — kos hanya berubah bila anda tekan Guna.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-[13px] font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {scanning ? 'Menyemak…' : 'Semak Kos dari Sheet'}
        </button>
      </div>

      {suggestions.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-gray-500">
          Tiada cadangan buat masa ini. Tekan <span className="font-semibold">Semak Kos dari Sheet</span> untuk baca kos terkini.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {suggestions.map((s) => {
            const naik = s.kos_buah_lama != null && s.kos_buah_baru > s.kos_buah_lama
            const turun = s.kos_buah_lama != null && s.kos_buah_baru < s.kos_buah_lama
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900">
                    {s.nama}
                    {s.variantNama ? <span className="font-normal text-gray-500"> · {s.variantNama}</span> : null}
                  </p>
                  <p className="text-[12px] text-gray-600">
                    <span className="text-gray-400">{s.kos_buah_lama != null ? rm(s.kos_buah_lama) : '(belum ada)'}</span>
                    {' → '}
                    <span className={`font-bold ${naik ? 'text-red-600' : turun ? 'text-green-600' : 'text-gray-900'}`}>
                      {rm(s.kos_buah_baru)}
                    </span>
                    <span className="ml-2 text-gray-400">
                      ({s.rule}: CFR {rm(s.cfr)}{s.clearance > 0 ? ` + clearance ${rm(s.clearance)}` : ''} · {s.tarikh})
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => resolve(s.id, 'apply')}
                    disabled={busy[s.id]}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Guna
                  </button>
                  <button
                    onClick={() => resolve(s.id, 'ignore')}
                    disabled={busy[s.id]}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                  >
                    Abai
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
