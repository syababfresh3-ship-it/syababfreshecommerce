'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Search, X, Store, Trash2, Save, BadgeCheck } from 'lucide-react'

interface Customer { id: string; name: string | null; phone_norm: string; email: string | null; order_count: number; total_spend: number; is_reseller?: boolean }
interface Reseller {
  id: string; customer_id: string; status: string; wholesale_tier: string | null
  commission_rate: number; territory: string | null; agreement_notes: string | null
  referral_code: string | null; joined_at: string | null
  customers: Customer | null
}

const STATUS = ['active', 'pending', 'suspended']
const STATUS_STYLE: Record<string, string> = {
  active:    'bg-green-100 text-green-700 border-green-200',
  pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  suspended: 'bg-red-100 text-red-600 border-red-200',
}

export function ResellersClient({ initial }: { initial: Reseller[] }) {
  const [rows, setRows] = useState<Reseller[]>(initial)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Reseller>>({})
  const [adding, setAdding] = useState(false)
  const [results, setResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function refresh() {
    const r = await fetch('/api/admin/resellers').then(r => r.json()).catch(() => null)
    if (Array.isArray(r)) setRows(r)
  }

  function onSearch(q: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const r = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => [])
      setResults(Array.isArray(r) ? r : [])
      setSearching(false)
    }, 300)
  }

  async function promote(c: Customer) {
    if (c.is_reseller) { toast.error('Sudah reseller'); return }
    const res = await fetch('/api/admin/resellers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: c.id }) })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Gagal'); return }
    toast.success(`${c.name ?? c.phone_norm} jadi reseller`)
    setAdding(false); setResults([]); refresh()
  }

  function startEdit(r: Reseller) { setEditId(r.id); setDraft({ status: r.status, wholesale_tier: r.wholesale_tier, commission_rate: r.commission_rate, territory: r.territory, agreement_notes: r.agreement_notes }) }

  async function save(id: string) {
    const res = await fetch('/api/admin/resellers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...draft }) })
    if (!res.ok) { toast.error('Gagal simpan'); return }
    toast.success('Disimpan'); setEditId(null); refresh()
  }

  async function remove(r: Reseller) {
    if (!confirm(`Buang status reseller untuk ${r.customers?.name ?? r.customers?.phone_norm}?`)) return
    const res = await fetch('/api/admin/resellers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, customer_id: r.customer_id }) })
    if (!res.ok) { toast.error('Gagal'); return }
    toast.success('Dibuang'); refresh()
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Store className="h-5 w-5 text-rose-500" /> Reseller</h1>
          <p className="text-sm text-gray-400 mt-0.5">{rows.length} reseller</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-rose-600 px-3.5 py-2 rounded-xl hover:bg-rose-700 shadow-sm">
          <Plus className="h-4 w-4" /> Tambah Reseller
        </button>
      </div>

      {rows.length === 0 && <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-2xl p-8 text-center">Belum ada reseller. Klik “Tambah Reseller” untuk promosi customer.</p>}

      <div className="space-y-3">
        {rows.map(r => {
          const c = r.customers
          const editing = editId === r.id
          return (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{c?.name ?? '—'}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] ?? ''}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-gray-400">{c?.phone_norm}{c?.email ? ` · ${c.email}` : ''}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {c?.order_count ?? 0} order · RM{Number(c?.total_spend ?? 0).toFixed(0)}
                    {r.referral_code ? <> · kod <span className="font-mono font-semibold text-rose-600">{r.referral_code}</span></> : null}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!editing && <button onClick={() => startEdit(r)} className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-2 py-1">Edit</button>}
                  <button onClick={() => remove(r)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {editing && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
                  <label className="text-xs text-gray-500">Status
                    <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50">
                      {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-gray-500">Tier harga borong
                    <input value={draft.wholesale_tier ?? ''} onChange={e => setDraft(d => ({ ...d, wholesale_tier: e.target.value }))} placeholder="cth: borong-a" className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
                  </label>
                  <label className="text-xs text-gray-500">Komisen (%)
                    <input type="number" value={draft.commission_rate ?? 0} onChange={e => setDraft(d => ({ ...d, commission_rate: Number(e.target.value) }))} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
                  </label>
                  <label className="text-xs text-gray-500">Kawasan
                    <input value={draft.territory ?? ''} onChange={e => setDraft(d => ({ ...d, territory: e.target.value }))} placeholder="cth: Selangor" className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
                  </label>
                  <label className="text-xs text-gray-500 col-span-2">Nota perjanjian
                    <textarea value={draft.agreement_notes ?? ''} onChange={e => setDraft(d => ({ ...d, agreement_notes: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
                  </label>
                  <div className="col-span-2 flex gap-2">
                    <button onClick={() => save(r.id)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-800"><Save className="h-3.5 w-3.5" /> Simpan</button>
                    <button onClick={() => setEditId(null)} className="text-sm text-gray-500 px-3 py-1.5">Batal</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50 p-4" onClick={() => setAdding(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Tambah Reseller</h2>
              <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input autoFocus onChange={e => onSearch(e.target.value)} placeholder="Cari nama atau telefon customer…" className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {searching && <p className="text-sm text-gray-400 py-3 text-center">Mencari…</p>}
              {!searching && results.length === 0 && <p className="text-sm text-gray-400 py-3 text-center">Taip nama atau no. telefon.</p>}
              {results.map(c => (
                <button key={c.id} onClick={() => promote(c)} disabled={c.is_reseller}
                  className="w-full flex items-center justify-between py-2.5 px-1 text-left hover:bg-gray-50 disabled:opacity-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{c.phone_norm} · {c.order_count} order · RM{Number(c.total_spend).toFixed(0)}</p>
                  </div>
                  {c.is_reseller
                    ? <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" />Reseller</span>
                    : <Plus className="h-4 w-4 text-rose-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
