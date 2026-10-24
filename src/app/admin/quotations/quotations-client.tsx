'use client'

// Senarai sebut harga (migration 146): ringkasan, penapis status/carian/tarikh, jadual,
// tindakan pantas (buka, PDF, salin pautan, duplicate). Ikon lucide monokrom.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, FileText, Copy, Link2, Loader2, Search, ExternalLink } from 'lucide-react'
import { QUOTATION_STATUSES, clientDisplayName, rm, statusLabel, type Quotation, type QuotationInvoiceRef } from '@/lib/quotation'

type Row = Quotation & { expired?: boolean; invoice?: QuotationInvoiceRef | null }
interface Summary { count: number; draft: number; issued: number; accepted: number; total_issued: number; total_accepted: number }

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  issued: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200 line-through',
  converted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}
const fmtDate = (v: string | null) => v ? new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function QuotationsClient() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams({ status })
    if (q.trim().length >= 2) sp.set('q', q.trim())
    if (from) sp.set('from', from)
    if (to) sp.set('to', to)
    const res = await fetch(`/api/admin/quotations?${sp}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(j.error ?? 'Gagal muat senarai'); setLoading(false); return }
    setRows(j.quotations ?? []); setSummary(j.summary ?? null); setLoading(false)
  }, [status, q, from, to])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  async function duplicate(id: string) {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/quotations/${id}/duplicate`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal'); return }
      toast.success('Salinan draf dibuat'); router.push(`/admin/quotations/${j.id}`)
    } finally { setBusy(null) }
  }
  function copyLink(token: string) {
    navigator.clipboard.writeText(`${location.origin}/q/${token}`).then(() => toast.success('Pautan disalin')).catch(() => toast.error('Gagal salin'))
  }

  const cards = useMemo(() => summary ? [
    { k: 'Sebut harga', v: String(summary.count), sub: `${summary.draft} draf · ${summary.issued} dikeluarkan` },
    { k: 'Nilai dikeluarkan', v: rm(summary.total_issued), sub: 'issued + accepted' },
    { k: 'Nilai diterima', v: rm(summary.total_accepted), sub: `${summary.accepted} diterima` },
  ] : [], [summary])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sebut Harga</h1>
          <p className="text-sm text-gray-500">Quotation untuk gift box, kurma borong & umum. Siri STSB-Q{new Date().getFullYear()}-####.</p>
        </div>
        <Link href="/admin/quotations/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800"><Plus className="h-4 w-4" />Sebut harga baharu</Link>
      </div>

      {cards.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          {cards.map(c => (
            <div key={c.k} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{c.k}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{c.v}</p>
              <p className="text-xs text-gray-500">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nombor / klien" className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white">
          <option value="all">Semua status</option>
          {QUOTATION_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white" aria-label="Dari tarikh" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white" aria-label="Hingga tarikh" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left font-bold px-3 py-2.5">Tarikh</th>
              <th className="text-left font-bold px-3 py-2.5">Nombor</th>
              <th className="text-left font-bold px-3 py-2.5">Klien</th>
              <th className="text-right font-bold px-3 py-2.5">Jumlah</th>
              <th className="text-left font-bold px-3 py-2.5">Status</th>
              <th className="text-left font-bold px-3 py-2.5">Sah hingga</th>
              <th className="text-left font-bold px-3 py-2.5">Invois</th>
              <th className="text-right font-bold px-3 py-2.5">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Tiada sebut harga.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(r.issued_at ?? r.created_at)}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap"><Link href={`/admin/quotations/${r.id}`} className="hover:underline">{r.quote_number ?? <span className="text-gray-400 font-normal">Draf</span>}</Link></td>
                <td className="px-3 py-2.5 text-gray-800 max-w-[260px] truncate">{clientDisplayName(r.client)}{r.source_type === 'gift_order' && <span className="ml-1.5 text-[10px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded">GIFT</span>}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{rm(r.total)}</td>
                <td className="px-3 py-2.5"><span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[r.expired ? 'expired' : r.status] ?? ''}`}>{r.expired ? 'Luput' : statusLabel(r.status)}</span></td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(r.valid_until)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {r.invoice ? (
                    <span className="inline-flex items-center gap-1.5">
                      {r.invoice.link ? <a href={r.invoice.link} target="_blank" rel="noreferrer" className="font-semibold text-gray-900 hover:underline">{r.invoice.number}</a> : <span className="font-semibold text-gray-900">{r.invoice.number}</span>}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${r.invoice.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : r.invoice.status === 'CANCELED' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{r.invoice.status}</span>
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/admin/quotations/${r.id}`} title="Buka" className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"><ExternalLink className="h-3.5 w-3.5" /></Link>
                    <a href={`/api/admin/quotations/${r.id}/pdf`} target="_blank" rel="noreferrer" title="PDF" className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"><FileText className="h-3.5 w-3.5" /></a>
                    {r.share_token && <button type="button" onClick={() => copyLink(r.share_token!)} title="Salin pautan klien" className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"><Link2 className="h-3.5 w-3.5" /></button>}
                    <button type="button" onClick={() => duplicate(r.id)} disabled={busy === r.id} title="Duplicate" className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50">{busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
