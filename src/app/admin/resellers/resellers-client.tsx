'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Search, X, Store, Trash2, Save, BadgeCheck, Tag, MessageCircle, Check } from 'lucide-react'

interface Customer { id: string; name: string | null; phone_norm: string; email: string | null; order_count: number; total_spend: number; is_reseller?: boolean }
interface Reseller {
  id: string; customer_id: string; status: string; wholesale_tier: string | null
  commission_rate: number; territory: string | null; agreement_notes: string | null
  referral_code: string | null; joined_at: string | null
  customers: Customer | null
  // Permohonan dari LP /kurma/borong (migration 144) — null untuk reseller yang dicipta admin
  application?: ResellerApplication | null; source?: string | null; created_at?: string
}
interface ResellerApplication {
  ref: string; business_name: string; business_type: string; name: string; phone: string; email: string | null
  state: string | null; est_qty: number; est_unit: 'kg' | 'ctn'; varieties: string[]; notes: string | null
  source_utm: string | null; submitted_at: string; history?: unknown[]
}
const BIZ_LABEL: Record<string, string> = { runcit: 'Kedai runcit / kafe', bazar: 'Bazar Ramadan', ejen: 'Ejen / stokis', masjid: 'Masjid / NGO / korporat' }
const STATUS_ORDER: Record<string, number> = { pending: 0, active: 1, suspended: 2 }

const STATUS = ['active', 'pending', 'suspended']
const STATUS_STYLE: Record<string, string> = {
  active:    'bg-green-100 text-green-700 border-green-200',
  pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  suspended: 'bg-red-100 text-red-600 border-red-200',
}

export function ResellersClient({ initial, initialFilter = 'all' }: { initial: Reseller[]; initialFilter?: string }) {
  const [rows, setRows] = useState<Reseller[]>(initial)
  const [filter, setFilter] = useState<string>(initialFilter)   // all | pending | active | suspended
  const counts = rows.reduce<Record<string, number>>((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m }, {})
  // Pending (permohonan LP borong) dahulu, kemudian ikut masa dicipta
  const visible = rows
    .filter(r => filter === 'all' || r.status === filter)
    .slice()
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Reseller>>({})
  const [adding, setAdding] = useState(false)
  const [results, setResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tambah reseller: 'search' = promosi customer sedia ada · 'new' = isi details terus
  const [mode, setMode] = useState<'search' | 'new'>('search')
  const [nf, setNf] = useState({ name: '', phone: '', email: '', address: '', postcode: '' })
  const [creating, setCreating] = useState(false)

  function closeAdd() {
    setAdding(false); setMode('search'); setResults([])
    setNf({ name: '', phone: '', email: '', address: '', postcode: '' })
  }

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
    if (c.is_reseller) { toast.error('Sudah pelanggan borong'); return }
    const res = await fetch('/api/admin/resellers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: c.id }) })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Gagal'); return }
    toast.success(`${c.name ?? c.phone_norm} jadi pelanggan borong`)
    setAdding(false); setResults([]); refresh()
  }

  // Cipta reseller baru terus (tanpa customer sedia ada) — server find-or-create customer ikut telefon
  async function createNew() {
    if (!nf.name.trim() || !nf.phone.trim()) { toast.error('Nama & telefon diperlukan'); return }
    setCreating(true)
    const res = await fetch('/api/admin/resellers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nf) })
    setCreating(false)
    if (!res.ok) { toast.error((await res.json()).error ?? 'Gagal'); return }
    toast.success(`${nf.name} jadi pelanggan borong`)
    closeAdd(); refresh()
  }

  function startEdit(r: Reseller) { setEditId(r.id); setDraft({ status: r.status, wholesale_tier: r.wholesale_tier, commission_rate: r.commission_rate, territory: r.territory, agreement_notes: r.agreement_notes }) }

  async function save(id: string) {
    const res = await fetch('/api/admin/resellers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...draft }) })
    if (!res.ok) { toast.error('Gagal simpan'); return }
    toast.success('Disimpan'); setEditId(null); refresh()
  }

  // Luluskan permohonan → status active (server isi joined_at/referral_code + customers.is_reseller)
  async function approve(r: Reseller) {
    const res = await fetch('/api/admin/resellers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, status: 'active' }) })
    if (!res.ok) { toast.error('Gagal luluskan'); return }
    toast.success(`${r.customers?.name ?? r.application?.business_name ?? 'Pelanggan borong'} diluluskan`); refresh()
  }

  async function remove(r: Reseller) {
    if (!confirm(`Buang status pelanggan borong untuk ${r.customers?.name ?? r.customers?.phone_norm}?`)) return
    const res = await fetch('/api/admin/resellers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, customer_id: r.customer_id }) })
    if (!res.ok) { toast.error('Gagal'); return }
    toast.success('Dibuang'); refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Store className="h-5 w-5 text-rose-500" /> Borong</h1>
          <p className="text-sm text-gray-400 mt-0.5">{rows.length} pelanggan borong{counts.pending ? ` · ${counts.pending} pending` : ''}</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-rose-600 px-3.5 py-2 rounded-xl hover:bg-rose-700 shadow-sm">
          <Plus className="h-4 w-4" /> Tambah Pelanggan Borong
        </button>
      </div>

      {/* Penapis status — permohonan LP borong masuk sebagai 'pending' */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {[['all', 'Semua', rows.length], ['pending', 'Pending', counts.pending ?? 0], ['active', 'Active', counts.active ?? 0], ['suspended', 'Suspended', counts.suspended ?? 0]].map(([id, label, n]) => (
          <button key={String(id)} onClick={() => setFilter(String(id))} aria-pressed={filter === id} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filter === id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>{label} <span className={filter === id ? 'text-white/70' : 'text-gray-400'}>{String(n)}</span></button>
        ))}
      </div>

      {rows.length === 0 && <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-2xl p-8 text-center">Belum ada pelanggan borong. Klik “Tambah Pelanggan Borong” untuk promosi customer.</p>}
      {rows.length > 0 && visible.length === 0 && <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-2xl p-8 text-center">Tiada pelanggan borong dengan status ini.</p>}

      <div className="space-y-3">
        {visible.map(r => {
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
                  {r.status === 'pending' && <button onClick={() => approve(r)} className="inline-flex items-center gap-1 text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 px-2.5 py-1.5 rounded-lg"><Check className="h-3.5 w-3.5" />Luluskan</button>}
                  {!editing && <button onClick={() => startEdit(r)} className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-2 py-1">Edit</button>}
                  <button onClick={() => remove(r)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {/* Permohonan LP borong (application jsonb, migration 144) */}
              {r.application && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Permohonan borong <span className="normal-case tracking-normal font-mono text-gray-500">{r.application.ref}</span> · {new Date(r.application.submitted_at).toLocaleString('en-MY')}{(r.application.history?.length ?? 0) > 0 ? ` · ${r.application.history!.length} permohonan sebelum` : ''}</p>
                  <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-gray-500">Perniagaan</dt><dd className="text-gray-900 font-medium">{r.application.business_name} <span className="text-gray-400 font-normal">· {BIZ_LABEL[r.application.business_type] ?? r.application.business_type}</span></dd>
                    <dt className="text-gray-500">Anggaran</dt><dd className="text-gray-900">{r.application.est_qty} {r.application.est_unit === 'kg' ? 'kg' : 'karton'} / bulan{r.application.state ? ` · ${r.application.state}` : ''}</dd>
                    {r.application.varieties?.length > 0 && <><dt className="text-gray-500">Kurma</dt><dd className="text-gray-900">{r.application.varieties.join(', ')}</dd></>}
                    {r.application.notes && <><dt className="text-gray-500">Nota</dt><dd className="text-gray-700">{r.application.notes}</dd></>}
                    {r.application.source_utm && <><dt className="text-gray-500">Sumber</dt><dd className="text-gray-500 text-xs">{r.application.source_utm}</dd></>}
                  </dl>
                  <a href={`https://wa.me/${r.application.phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50"><MessageCircle className="h-3.5 w-3.5" />WhatsApp pemohon</a>
                </div>
              )}

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
                  <div className="col-span-2 pt-3 border-t border-gray-100">
                    <ResellerPrices resellerId={r.id} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50 p-4" onClick={closeAdd}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Tambah Pelanggan Borong</h2>
              <button onClick={closeAdd} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            {/* Toggle: promosi customer sedia ada vs isi details terus */}
            <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setMode('search')} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${mode === 'search' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Cari customer</button>
              <button onClick={() => setMode('new')} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${mode === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Pelanggan baru</button>
            </div>

            {mode === 'search' ? (
              <>
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
                        ? <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" />Borong</span>
                        : <Plus className="h-4 w-4 text-rose-500" />}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-2.5">
                <input autoFocus value={nf.name} onChange={e => setNf(f => ({ ...f, name: e.target.value }))} placeholder="Nama pelanggan / kedai *" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-300" />
                <input value={nf.phone} onChange={e => setNf(f => ({ ...f, phone: e.target.value }))} placeholder="No. telefon *" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-300" />
                <input value={nf.email} onChange={e => setNf(f => ({ ...f, email: e.target.value }))} placeholder="Email (pilihan)" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-300" />
                <textarea value={nf.address} onChange={e => setNf(f => ({ ...f, address: e.target.value }))} placeholder="Alamat (pilihan)" rows={2} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none" />
                <input value={nf.postcode} onChange={e => setNf(f => ({ ...f, postcode: e.target.value }))} placeholder="Poskod (pilihan)" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-300" />
                <button onClick={createNew} disabled={creating} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-rose-600 py-2.5 rounded-xl hover:bg-rose-700 disabled:opacity-50">
                  <Plus className="h-4 w-4" /> {creating ? 'Menyimpan…' : 'Tambah Pelanggan Borong'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Editor harga borong dipersetujui (per reseller, per produk/variant) ─────────
interface RPrice { id: string; product_id: string; variant_id: string | null; price: number; products: { name: string } | null; product_variants: { name: string } | null }
interface PProduct { id: string; name: string; price: number; product_variants: { id: string; name: string; price: number; is_active: boolean }[] }

function ResellerPrices({ resellerId }: { resellerId: string }) {
  const [prices, setPrices] = useState<RPrice[]>([])
  const [products, setProducts] = useState<PProduct[]>([])
  const [pid, setPid] = useState('')
  const [vid, setVid] = useState('')
  const [price, setPrice] = useState('')

  async function load() {
    const d = await fetch(`/api/admin/resellers/${resellerId}/prices`).then(r => r.json()).catch(() => [])
    setPrices(Array.isArray(d) ? d : [])
  }
  useEffect(() => {
    load()
    fetch('/api/admin/landing-pages/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [resellerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selProduct = products.find(p => p.id === pid)
  const variants = (selProduct?.product_variants ?? []).filter(v => v.is_active)

  async function add() {
    if (!pid || !price) { toast.error('Pilih produk & isi harga'); return }
    const res = await fetch(`/api/admin/resellers/${resellerId}/prices`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: pid, variant_id: vid || null, price: Number(price) }),
    })
    if (!res.ok) { toast.error((await res.json().catch(() => ({})))?.error ?? 'Gagal'); return }
    toast.success('Harga disimpan'); setPrice(''); setVid(''); load()
  }
  async function del(id: string) {
    const res = await fetch(`/api/admin/resellers/${resellerId}/prices`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price_id: id }),
    })
    if (!res.ok) { toast.error('Gagal'); return }
    load()
  }

  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Harga Borong</p>
      <div className="space-y-1 mb-3">
        {prices.length === 0 && <p className="text-xs text-gray-400">Belum ada harga dipersetujui — order borong akan jatuh ke harga retail.</p>}
        {prices.map(p => (
          <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-700 truncate">{p.products?.name ?? '—'}{p.product_variants?.name ? ` (${p.product_variants.name})` : ''}</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-gray-900">RM{Number(p.price).toFixed(2)}</span>
              <button onClick={() => del(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <select value={pid} onChange={e => { setPid(e.target.value); setVid('') }} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50">
          <option value="">Pilih produk…</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {variants.length > 0 && (
          <select value={vid} onChange={e => setVid(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50">
            <option value="">Produk asas</option>
            {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="RM harga" className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
        <button onClick={add} className="text-sm font-semibold text-white bg-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-700">Tambah</button>
      </div>
    </div>
  )
}
