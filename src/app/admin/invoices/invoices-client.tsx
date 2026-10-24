'use client'

// Senarai dokumen Refrens (invois, sebut harga lama, nota kredit…) ditarik langsung dari API
// Refrens (baca sahaja): penapis jenis/status, carian nombor atau nama klien, muka surat,
// pautan buka di Refrens. Cipta/edit dibuat di Refrens atau dari sebut harga website.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Search, ExternalLink, ChevronLeft, ChevronRight, RefreshCw, Plus, Banknote, Ban } from 'lucide-react'
import { rm } from '@/lib/quotation'

interface Row { id: string; billType: string; number: string; status: string; date: string | null; dueDate: string | null; currency: string; total: number | null; paid: number; clientName: string | null; clientEmail: string | null; url: string }

const TYPES: [string, string][] = [['INVOICE', 'Invois'], ['QUOTATION', 'Sebut harga (Refrens)'], ['PROFORMA', 'Proforma'], ['CREDITNOTE', 'Nota kredit'], ['ALL', 'Semua dokumen']]
const STATUSES: [string, string][] = [['ALL', 'Semua status'], ['UNPAID', 'Belum bayar'], ['PARTIAL', 'Separa bayar'], ['PAID', 'Dibayar'], ['CANCELED', 'Dibatalkan']]
const TYPE_LABEL: Record<string, string> = { INVOICE: 'Invois', QUOTATION: 'Sebut harga', PROFORMA: 'Proforma', CREDITNOTE: 'Nota kredit', DEBITNOTE: 'Nota debit', DELIVERYCHALLAN: 'Delivery challan', SALESORDER: 'Sales order', PURCHASEORDER: 'Purchase order' }
const STATUS_CLS: Record<string, string> = { PAID: 'bg-green-50 text-green-700 border-green-200', UNPAID: 'bg-amber-50 text-amber-700 border-amber-200', PARTIAL: 'bg-blue-50 text-blue-700 border-blue-200', CANCELED: 'bg-gray-100 text-gray-500 border-gray-200', CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200' }
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const METHODS: [string, string][] = [['ACCOUNT_TRANSFER', 'Pindahan bank'], ['CASH', 'Tunai'], ['CHEQUE', 'Cek'], ['CREDIT_CARD', 'Kad kredit'], ['DEBIT_CARD', 'Kad debit']]
const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900'
const today = () => new Date().toISOString().slice(0, 10)

export function InvoicesClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [type, setType] = useState('INVOICE')
  const [status, setStatus] = useState('ALL')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payFor, setPayFor] = useState<Row | null>(null)
  const [pay, setPay] = useState({ amount: '', date: today(), method: 'ACCOUNT_TRANSFER', refId: '', notes: '' })
  const [payConfirm, setPayConfirm] = useState(false)
  const [cancelFor, setCancelFor] = useState<Row | null>(null)
  const [cancelPayments, setCancelPayments] = useState(false)
  const [busy, setBusy] = useState(false)
  const limit = 25

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const sp = new URLSearchParams({ type, status, page: String(page), limit: String(limit) })
    if (q.trim().length >= 2) sp.set('q', q.trim())
    const res = await fetch(`/api/admin/refrens/invoices?${sp}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(j.error ?? 'Gagal muat dari Refrens'); setRows([]); setTotal(0); setLoading(false); return }
    setRows(j.data ?? []); setTotal(j.total ?? 0); setLoading(false)
  }, [type, status, page, q])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const pages = Math.max(1, Math.ceil(total / limit))

  function openPay(r: Row) {
    const due = r.total && r.total > 0 ? Math.max(0, r.total - r.paid) : 0
    setPay({ amount: due > 0 ? due.toFixed(2) : '', date: today(), method: 'ACCOUNT_TRANSFER', refId: '', notes: '' })
    setPayConfirm(false); setCancelFor(null); setPayFor(r)
  }
  async function submitPay() {
    if (!payFor) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/refrens/invoices/${payFor.id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(pay.amount), paymentDate: pay.date, paymentMethod: pay.method, refId: pay.refId, notes: pay.notes }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal rekod bayaran'); return }
      toast.success(`Bayaran ${rm(Number(pay.amount))} direkod untuk ${payFor.number}`); setPayFor(null); await load()
    } finally { setBusy(false); setPayConfirm(false) }
  }
  async function submitCancel() {
    if (!cancelFor) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/refrens/invoices/${cancelFor.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelPayment: cancelPayments }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal batal'); return }
      toast.success(`${cancelFor.number} dibatalkan di Refrens`); setCancelFor(null); await load()
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invois Refrens</h1>
          <p className="text-sm text-gray-500">Ditarik terus dari akaun Refrens, baca sahaja. Cipta invois dari sebut harga website atau di Refrens.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { toast.message('Memuat semula dari Refrens'); load() }} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"><RefreshCw className="h-4 w-4" />Muat semula</button>
          <Link href="/admin/invoices/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800"><Plus className="h-4 w-4" />Cipta invois</Link>
        </div>
      </div>

      {payFor && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Rekod bayaran · {payFor.number} · {payFor.clientName ?? '—'}{payFor.total ? ` · jumlah ${rm(payFor.total)}` : ''}{payFor.paid > 0 ? ` · dibayar ${rm(payFor.paid)}` : ''}</p>
          <div className="grid sm:grid-cols-5 gap-2">
            <label className="text-xs font-semibold text-gray-600">Jumlah (RM)<input type="number" min="0.01" step="0.01" value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: e.target.value }))} className={`${inp} w-full mt-1 font-mono`} /></label>
            <label className="text-xs font-semibold text-gray-600">Tarikh<input type="date" value={pay.date} onChange={e => setPay(p => ({ ...p, date: e.target.value }))} className={`${inp} w-full mt-1`} /></label>
            <label className="text-xs font-semibold text-gray-600">Kaedah<select value={pay.method} onChange={e => setPay(p => ({ ...p, method: e.target.value }))} className={`${inp} w-full mt-1`}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="text-xs font-semibold text-gray-600">Rujukan<input value={pay.refId} onChange={e => setPay(p => ({ ...p, refId: e.target.value }))} placeholder="No. transaksi" className={`${inp} w-full mt-1`} /></label>
            <label className="text-xs font-semibold text-gray-600">Nota<input value={pay.notes} onChange={e => setPay(p => ({ ...p, notes: e.target.value }))} className={`${inp} w-full mt-1`} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {payConfirm
              ? <span className="inline-flex items-center gap-2 text-sm"><span className="text-gray-600">Rekod {rm(Number(pay.amount) || 0)} ke Refrens?</span><button type="button" onClick={submitPay} disabled={busy} className="font-bold text-gray-900 inline-flex items-center gap-1">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Ya</button><button type="button" onClick={() => setPayConfirm(false)} className="text-gray-500">Tidak</button></span>
              : <button type="button" onClick={() => setPayConfirm(true)} disabled={!(Number(pay.amount) > 0) || !pay.date} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50"><Banknote className="h-4 w-4" />Rekod bayaran</button>}
            <button type="button" onClick={() => setPayFor(null)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50">Tutup</button>
            <span className="text-xs text-gray-400">Masuk terus ke akaun Refrens; bayaran tak boleh dipadam melalui API.</span>
          </div>
        </div>
      )}
      {cancelFor && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Batalkan invois · {cancelFor.number} · {cancelFor.clientName ?? '—'}</p>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={cancelPayments} onChange={e => setCancelPayments(e.target.checked)} className="accent-gray-900" />Batalkan juga bayaran yang direkod pada invois ini</label>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" onClick={submitCancel} disabled={busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}Sahkan batal di Refrens</button>
            <button type="button" onClick={() => setCancelFor(null)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50">Tutup</button>
            <span className="text-xs text-gray-400">Status jadi CANCELED, nombor kekal dalam rekod. Tak boleh diundur.</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Nombor dokumen atau nama klien" className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1) }} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <span className="text-sm text-gray-500 ml-auto">{loading ? '…' : `${total.toLocaleString('en-MY')} dokumen`}</span>
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-3" role="alert">{error}</div>}

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left font-bold px-3 py-2.5">Tarikh</th>
              <th className="text-left font-bold px-3 py-2.5">Nombor</th>
              <th className="text-left font-bold px-3 py-2.5">Jenis</th>
              <th className="text-left font-bold px-3 py-2.5">Klien</th>
              <th className="text-right font-bold px-3 py-2.5">Jumlah</th>
              <th className="text-right font-bold px-3 py-2.5">Dibayar</th>
              <th className="text-left font-bold px-3 py-2.5">Status</th>
              <th className="text-right font-bold px-3 py-2.5">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Tiada dokumen.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{r.number || '—'}</td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{TYPE_LABEL[r.billType] ?? r.billType}</td>
                <td className="px-3 py-2.5 text-gray-800 max-w-[260px] truncate">{r.clientName ?? '—'}</td>
                {/* Refrens pulangkan finalTotal 0 untuk sesetengah invois PAID lama — guna jumlah bayaran sebagai ganti */}
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap" title={r.total && r.total > 0 ? undefined : 'Jumlah dari rekod bayaran (Refrens tidak beri jumlah invois)'}>{r.total && r.total > 0 ? rm(r.total) : r.paid > 0 ? rm(r.paid) : '—'}</td>
                <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">{r.paid > 0 ? rm(r.paid) : '—'}</td>
                <td className="px-3 py-2.5"><span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[r.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>{r.status || '—'}</span></td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {r.billType === 'INVOICE' && !['PAID', 'CANCELED', 'CANCELLED'].includes(r.status) && <button type="button" onClick={() => openPay(r)} title="Rekod bayaran" className="inline-grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"><Banknote className="h-3.5 w-3.5" /></button>}
                    {r.billType === 'INVOICE' && !['CANCELED', 'CANCELLED'].includes(r.status) && <button type="button" onClick={() => { setPayFor(null); setCancelPayments(false); setCancelFor(r) }} title="Batalkan invois" className="inline-grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"><Ban className="h-3.5 w-3.5" /></button>}
                    <a href={r.url} target="_blank" rel="noreferrer" title="Buka di Refrens" className="inline-grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"><ExternalLink className="h-3.5 w-3.5" /></a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 text-sm text-gray-600">
        <span>Muka {page} / {pages}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-40" aria-label="Muka sebelum"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages || loading} className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-40" aria-label="Muka seterusnya"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  )
}
