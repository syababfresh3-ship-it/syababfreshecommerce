'use client'

// Jadual pricing dengan inline edit kos. Kira live guna formula sama dengan server.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  computeUnitEconomics, statusOf, cadanganHarga, kosTetap, fmtRM,
  type GatewaySettings, type StatusKos,
} from '@/lib/pricing/costing'

export interface PricingRow {
  productId: string
  variantId: string | null
  nama: string
  variantNama: string | null
  imageUrl: string | null
  harga: number
  kos: { kos_buah: number; kos_packaging: number; kos_kurier: number; kos_lain: number; source: string } | null
}

const STATUS_STYLE: Record<StatusKos, string> = {
  bahaya: 'bg-red-50 text-red-700',
  perhatian: 'bg-amber-50 text-amber-700',
  sihat: 'bg-green-50 text-green-700',
}
const STATUS_LABEL: Record<StatusKos, string> = {
  bahaya: 'Bahaya',
  perhatian: 'Perhatian',
  sihat: 'Sihat',
}

type Draft = { kos_buah: string; kos_packaging: string; kos_kurier: string; kos_lain: string }

function draftOf(row: PricingRow): Draft {
  return {
    kos_buah: row.kos ? String(row.kos.kos_buah) : '',
    kos_packaging: row.kos ? String(row.kos.kos_packaging) : '',
    kos_kurier: row.kos ? String(row.kos.kos_kurier) : '',
    kos_lain: row.kos ? String(row.kos.kos_lain) : '',
  }
}

function num(s: string): number {
  const n = parseFloat(s)
  return isFinite(n) && n >= 0 ? n : 0
}

export function PricingTable({ rows, settings }: { rows: PricingRow[]; settings: GatewaySettings }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  const keyOf = (r: PricingRow) => `${r.productId}:${r.variantId ?? 'null'}`

  function getDraft(r: PricingRow): Draft {
    return drafts[keyOf(r)] ?? draftOf(r)
  }

  function setField(r: PricingRow, field: keyof Draft, value: string) {
    const k = keyOf(r)
    setDrafts((d) => ({ ...d, [k]: { ...getDraft(r), [field]: value } }))
    setDirty((d) => ({ ...d, [k]: true }))
  }

  async function save(r: PricingRow) {
    const k = keyOf(r)
    const d = getDraft(r)
    setSaving((s) => ({ ...s, [k]: true }))
    try {
      const res = await fetch('/api/admin/pricing/costs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: r.productId,
          variant_id: r.variantId,
          kos_buah: num(d.kos_buah),
          kos_packaging: num(d.kos_packaging),
          kos_kurier: num(d.kos_kurier),
          kos_lain: num(d.kos_lain),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal simpan')
      toast.success('Kos disimpan')
      setDirty((x) => ({ ...x, [k]: false }))
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal simpan')
    } finally {
      setSaving((s) => ({ ...s, [k]: false }))
    }
  }

  const filtered = search.trim()
    ? rows.filter((r) => `${r.nama} ${r.variantNama ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    : rows

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari produk…"
        className="mb-3 w-full sm:w-72 rounded-xl border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-red-200"
      />

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-3 py-2 font-semibold">Produk</th>
              <th className="px-3 py-2 font-semibold text-right">Harga</th>
              <th className="px-3 py-2 font-semibold text-right">Kos Buah</th>
              <th className="px-3 py-2 font-semibold text-right">Packaging</th>
              <th className="px-3 py-2 font-semibold text-right">Kurier</th>
              <th className="px-3 py-2 font-semibold text-right">Lain</th>
              <th className="px-3 py-2 font-semibold text-right">Fee+Komisen*</th>
              <th className="px-3 py-2 font-semibold text-right">Kos Total</th>
              <th className="px-3 py-2 font-semibold text-right">Untung</th>
              <th className="px-3 py-2 font-semibold text-right">Margin</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold text-right">Cadangan @{settings.targetMarginPct}%</th>
              <th className="px-3 py-2 font-semibold text-right">Cadangan @{settings.targetMarginPct2}%</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const k = keyOf(r)
              const d = getDraft(r)
              const hasAny = r.kos != null || dirty[k]
              const cost = {
                kos_buah: num(d.kos_buah),
                kos_packaging: num(d.kos_packaging),
                kos_kurier: num(d.kos_kurier),
                kos_lain: num(d.kos_lain),
              }
              const eco = computeUnitEconomics(r.harga, cost, settings)
              const status = statusOf(eco.untung, eco.marginPct)
              const cadangan = cadanganHarga(eco.kosTetap, settings, settings.targetMarginPct)
              const cadangan2 = cadanganHarga(eco.kosTetap, settings, settings.targetMarginPct2)

              const inputCls =
                'w-16 rounded-lg border border-gray-200 px-1.5 py-1 text-right text-[12px] focus:outline-none focus:ring-1 focus:ring-red-300'

              return (
                <tr key={k} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <div className="font-bold text-gray-900 leading-tight">{r.nama}</div>
                    {r.variantNama && <div className="text-gray-500">{r.variantNama}</div>}
                  </td>
                  <td className="px-3 py-2 text-right font-bold whitespace-nowrap">{fmtRM(r.harga)}</td>
                  {(['kos_buah', 'kos_packaging', 'kos_kurier', 'kos_lain'] as const).map((f) => (
                    <td key={f} className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={d[f]}
                        placeholder="0"
                        onChange={(e) => setField(r, f, e.target.value)}
                        className={inputCls}
                      />
                    </td>
                  ))}
                  {hasAny ? (
                    <>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">{fmtRM(eco.kosGateway + eco.kosSalesTeam + eco.kosMarketing)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtRM(eco.kosTotal)}</td>
                      <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${eco.untung < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {fmtRM(eco.untung)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{eco.marginPct.toFixed(1)}%</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                        {cadangan ? fmtRM(cadangan) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                        {cadangan2 ? fmtRM(cadangan2) : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right text-gray-300">—</td>
                      <td className="px-3 py-2 text-right text-gray-300">—</td>
                      <td className="px-3 py-2 text-right text-gray-300">—</td>
                      <td className="px-3 py-2 text-right text-gray-300">—</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                          Kos belum diisi
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">—</td>
                      <td className="px-3 py-2 text-right text-gray-300">—</td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right">
                    {dirty[k] && (
                      <button
                        onClick={() => save(r)}
                        disabled={saving[k]}
                        className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {saving[k] ? '…' : 'Simpan'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-gray-400">
        *Fee+Komisen = gateway (kadar FPX) + komisen sales + peruntukan marketing, dikira dari harga jual.
        Cadangan harga adalah cadangan sahaja — harga jual tidak diubah automatik.
      </p>
    </div>
  )
}
