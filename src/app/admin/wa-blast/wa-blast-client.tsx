'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Search, Copy, Send, AlertTriangle, Store, Globe, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'

const PAGE_SIZE = 50

export interface BlastRow {
  source: 'shop' | 'lp'
  name: string
  phone: string
  order_number: string
  carrier: string
  tracking: string
  date: string                 // delivering_at ?? created_at (ISO)
  blasted_at: string | null    // wa_blasted_at — bila dah diblast via ReplyLa
  phone_valid?: boolean
}

function csvCell(c: string) {
  const s = String(c ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(filename: string, rows: string[]) {
  const bom = '﻿'
  const blob = new Blob([bom + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Tarikh MY (yyyy-mm-dd) dari ISO — untuk padan dengan input <date> & elak offset UTC
function myDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
}

const TODAY_MY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })

// Template contoh untuk disalin ke ReplyLa (variable {{1}}..{{4}} padan susunan kolum CSV)
const SAMPLE_TEMPLATE = `Hai {{2}}! 🚚

Pesanan SyababFresh anda (No. {{3}}) sedang dalam penghantaran.

Jejak penghantaran di sini:
{{4}}

Terima kasih kerana membeli-belah dengan kami! 🌿
_SyababFresh — Buah Segar Setiap Hari_`

const rowReady = (r: BlastRow) => Boolean(r.phone_valid && r.tracking)

export function WaBlastClient({ rows }: { rows: BlastRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState(TODAY_MY)
  const [to, setTo] = useState(TODAY_MY)
  const [hideBlasted, setHideBlasted] = useState(true)
  // Override pilihan manual (order_number → ticked?). Default sebenar dikira: ready && belum blast.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map())
  const [page, setPage] = useState(1)
  const [marking, setMarking] = useState(false)

  // Sebuah baris dipilih secara default jika sedia (phone+tracking) DAN belum pernah diblast.
  // Override manual mengatasi default — termasuk untuk re-blast baris yg sudah ditanda.
  const isChecked = (r: BlastRow): boolean => {
    const o = overrides.get(r.order_number)
    if (o !== undefined) return o
    return rowReady(r) && !r.blasted_at
  }

  // Skop tarikh + carian (tanpa hideBlasted) — untuk stats
  const inScope = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const d = myDate(r.date)
      if (from && d < from) return false
      if (to && d > to) return false
      if (!q) return true
      return r.name.toLowerCase().includes(q) || r.phone.includes(q) || r.order_number.toLowerCase().includes(q)
    })
  }, [rows, search, from, to])

  // Yang dipaparkan dalam jadual (boleh sembunyi yang dah blast)
  const filtered = useMemo(
    () => (hideBlasted ? inScope.filter((r) => !r.blasted_at) : inScope),
    [inScope, hideBlasted],
  )

  const selected = useMemo(
    () => filtered.filter((r) => rowReady(r) && isChecked(r)),
    [filtered, overrides], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Pagination — reset ke page 1 bila penapis berubah, & clamp jika luar julat
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPage(1) }, [from, to, search, hideBlasted])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )
  const pageReady = useMemo(() => paged.filter(rowReady), [paged])
  // "Pilih semua" beroperasi pada page semasa (lebih jelas dgn pagination)
  const pageAllSelected = pageReady.length > 0 && pageReady.every(isChecked)

  function toggleRow(r: BlastRow) {
    setOverrides((prev) => {
      const next = new Map(prev)
      next.set(r.order_number, !isChecked(r))
      return next
    })
  }

  function togglePage() {
    const target = !pageAllSelected
    setOverrides((prev) => {
      const next = new Map(prev)
      for (const r of pageReady) next.set(r.order_number, target)
      return next
    })
  }

  const stats = useMemo(() => ({
    totalScope: inScope.length,
    selected: selected.length,
    blasted: inScope.filter((r) => r.blasted_at).length,
    noPhone: inScope.filter((r) => !r.phone_valid).length,
  }), [inScope, selected])

  async function handleDownload() {
    if (selected.length === 0) { toast.error('Tiada baris dipilih'); return }
    const picked = selected.map((r) => r.order_number)

    // 1) Muat turun CSV
    const header = ['phone', 'name', 'order_number', 'tracking_link'].map(csvCell).join(',')
    const body = selected.map((r) =>
      [csvCell(r.phone), csvCell(r.name), csvCell(r.order_number), csvCell(r.tracking)].join(','),
    )
    downloadCsv(`replyla-tracking-${TODAY_MY}.csv`, [header, ...body])

    // 2) Tandakan 'dah blast' supaya tak terexport dua kali
    setMarking(true)
    try {
      const res = await fetch('/api/admin/wa-blast/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_numbers: picked }),
      })
      if (!res.ok) {
        toast.error('CSV dimuat turun, tapi gagal tandakan "dah blast". Cuba lagi.')
        return
      }
      toast.success(`${picked.length} dieksport & ditanda dah blast`)
      setOverrides(new Map())
      router.refresh()
    } catch {
      toast.error('CSV dimuat turun, tapi gagal tandakan "dah blast".')
    } finally {
      setMarking(false)
    }
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(SAMPLE_TEMPLATE)
      toast.success('Template disalin')
    } catch { toast.error('Gagal salin') }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Send className="h-5 w-5 text-brand-fresh-600" /> WA Blast Tracking (ReplyLa)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Export order status <span className="font-semibold">delivering</span> (shop + landing page) → muat naik CSV ke
          ReplyLa Blaster untuk hantar tracking guna WhatsApp rasmi. Senarai = 7 hari terakhir. Yang dah diblast ditanda
          automatik supaya tak terhantar dua kali.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Dalam julat tarikh" value={stats.totalScope} />
        <Stat label="Dipilih untuk export" value={stats.selected} tone="green" />
        <Stat label="Dah diblast" value={stats.blasted} />
        <Stat label="Tiada phone sah" value={stats.noPhone} tone={stats.noPhone ? 'red' : undefined} />
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-100 rounded-xl p-3">
        <label className="text-xs text-gray-500">
          Dari tarikh
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="block mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-fresh-500" />
        </label>
        <label className="text-xs text-gray-500">
          Hingga tarikh
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="block mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-fresh-500" />
        </label>
        <div className="flex gap-1.5">
          <button onClick={() => { setFrom(TODAY_MY); setTo(TODAY_MY) }}
            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Hari ini</button>
          <button onClick={() => { setFrom(''); setTo('') }}
            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">7 hari terakhir</button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
          <input type="checkbox" checked={hideBlasted} onChange={(e) => setHideBlasted(e.target.checked)} />
          Sembunyi yang dah blast
        </label>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, phone, no. order…"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-fresh-500" />
        </div>
        <button onClick={handleDownload} disabled={selected.length === 0 || marking}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-fresh-600 rounded-lg hover:bg-brand-fresh-700 disabled:opacity-50">
          <Download className="h-4 w-4" /> {marking ? 'Menanda…' : `Download CSV (${selected.length})`}
        </button>
      </div>

      {/* Template helper */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-blue-900">Template contoh untuk ReplyLa</p>
          <button onClick={copyTemplate} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900">
            <Copy className="h-3.5 w-3.5" /> Salin
          </button>
        </div>
        <p className="text-xs text-blue-700 mb-2">
          Kolum CSV ikut susunan: <code>{'{{1}}'}=phone, {'{{2}}'}=name, {'{{3}}'}=order_number, {'{{4}}'}=tracking_link</code>
        </p>
        <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-white rounded-lg p-3 border border-blue-100">{SAMPLE_TEMPLATE}</pre>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 w-10">
                <input type="checkbox" checked={pageAllSelected} onChange={togglePage}
                  disabled={pageReady.length === 0} title="Pilih semua dalam page ini" />
              </th>
              <th className="text-left px-3 py-2 font-medium">Sumber</th>
              <th className="text-left px-3 py-2 font-medium">Nama</th>
              <th className="text-left px-3 py-2 font-medium">Phone</th>
              <th className="text-left px-3 py-2 font-medium">No. Order</th>
              <th className="text-left px-3 py-2 font-medium">Tarikh</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Tracking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Tiada order delivering dalam julat ini.</td></tr>
            )}
            {paged.map((r) => {
              const ready = rowReady(r)
              return (
                <tr key={r.order_number} className={`hover:bg-gray-50 ${!ready ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={isChecked(r)} disabled={!ready}
                      onChange={() => toggleRow(r)}
                      title={ready ? '' : 'Perlu phone sah + tracking'} />
                  </td>
                  <td className="px-3 py-2">
                    {r.source === 'shop'
                      ? <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Store className="h-3.5 w-3.5" /> Shop</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Globe className="h-3.5 w-3.5" /> LP</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-900">{r.name || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.phone_valid
                      ? r.phone
                      : <span className="inline-flex items-center gap-1 text-red-500"><AlertTriangle className="h-3 w-3" /> {r.phone || 'kosong'}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.order_number}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{myDate(r.date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.blasted_at
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Blast {myDate(r.blasted_at).slice(5)}</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate">
                    {r.tracking
                      ? <span className="text-xs text-blue-600">{r.tracking}</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} drpd {filtered.length}
            <span className="text-gray-400"> · {selected.length} dipilih (semua page)</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Sebelum
            </button>
            <span className="text-gray-500">Page {page}/{pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              Seterus <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-brand-fresh-700' : tone === 'red' ? 'text-red-600' : 'text-gray-900'
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
