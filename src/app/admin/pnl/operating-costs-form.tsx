'use client'

// Panel Kos Operasi: senarai + borang tambah (cth: trip transport harian RM100 ke warehouse Bangi).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { fmtRM } from '@/lib/pricing/costing'

interface OpCost {
  id: string
  tarikh: string
  jenis: string
  amaun: number
  nota: string | null
}

const JENIS_LABEL: Record<string, string> = {
  transport: 'Transport',
  pekerja: 'Pekerja',
  sewa: 'Sewa',
  lain: 'Lain-lain',
}

export function OperatingCostsPanel({ costs }: { costs: OpCost[] }) {
  const router = useRouter()
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [tarikh, setTarikh] = useState(today)
  const [jenis, setJenis] = useState('transport')
  const [amaun, setAmaun] = useState('')
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    const n = parseFloat(amaun)
    if (!isFinite(n) || n <= 0) { toast.error('Masukkan amaun yang sah'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/pricing/operating-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarikh, jenis, amaun: n, nota: nota.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal')
      toast.success('Kos operasi ditambah')
      setAmaun('')
      setNota('')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/pricing/operating-costs?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal padam')
      toast.success('Dipadam')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setBusy(false)
    }
  }

  const total = costs.reduce((s, c) => s + c.amaun, 0)

  return (
    <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-extrabold text-gray-900">Kos Operasi (dalam julat)</h2>
        <span className="text-[13px] font-bold text-gray-700">{fmtRM(total)}</span>
      </div>

      {/* Borang tambah */}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] font-bold text-gray-500 mb-1">Tarikh</label>
          <input type="date" value={tarikh} onChange={(e) => setTarikh(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-[13px]" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 mb-1">Jenis</label>
          <select value={jenis} onChange={(e) => setJenis(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-[13px] bg-white">
            <option value="transport">Transport</option>
            <option value="pekerja">Pekerja</option>
            <option value="sewa">Sewa</option>
            <option value="lain">Lain-lain</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 mb-1">Amaun (RM)</label>
          <input type="number" min="0" step="0.01" value={amaun} onChange={(e) => setAmaun(e.target.value)}
            placeholder="100.00" className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-right text-[13px]" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] font-bold text-gray-500 mb-1">Nota</label>
          <input value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="cth: trip ambil barang ke warehouse Bangi"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[13px]" />
        </div>
        <button onClick={add} disabled={busy}
          className="rounded-full bg-red-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-red-700 disabled:opacity-50">
          Tambah
        </button>
      </div>

      {/* Senarai */}
      {costs.length > 0 ? (
        <div className="space-y-1">
          {costs.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-500 whitespace-nowrap">{c.tarikh}</span>
                <span className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                  {JENIS_LABEL[c.jenis] ?? c.jenis}
                </span>
                {c.nota && <span className="text-gray-500 truncate">{c.nota}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold">{fmtRM(c.amaun)}</span>
                <button onClick={() => remove(c.id)} disabled={busy}
                  className="text-gray-300 hover:text-red-500 text-[14px] leading-none" aria-label="Padam">×</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-gray-400">Tiada kos operasi direkod dalam julat ini. Contoh guna: setiap trip ambil barang (RM100/hari), key in sini.</p>
      )}
    </div>
  )
}
