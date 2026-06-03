'use client'

import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { Search, Users, X, Tag as TagIcon, Store, Plus, StickyNote, Send, MessageSquare, Mail, AlertTriangle, Loader2 } from 'lucide-react'
import { SEGMENT_CONFIG, type Segment } from '../customers/segment-utils'

interface Contact {
  id: string; name: string | null; phone_norm: string; email: string | null
  sources: string[]; tags: string[]; is_reseller: boolean
  order_count: number; total_spend: number; last_order_at: string | null; first_seen_at: string | null
  consent_wa: boolean | null; consent_email: boolean | null
  segment: Segment; channel: string
}
interface Note { id: string; body: string; author: string | null; created_at: string }

const SEGMENT_ORDER: (Segment | 'all')[] = ['all', 'vip', 'active', 'new', 'at_risk', 'inactive', 'no_orders']
const SOURCES = ['lp', 'store', 'lead', 'tiktok', 'whatsapp', 'web', 'manual']
const SOURCE_STYLE: Record<string, string> = {
  store: 'bg-teal-100 text-teal-700', lp: 'bg-rose-100 text-rose-700', lead: 'bg-gray-100 text-gray-500',
  tiktok: 'bg-purple-100 text-purple-700', whatsapp: 'bg-green-100 text-green-700', web: 'bg-blue-100 text-blue-700', manual: 'bg-amber-100 text-amber-700',
}

export function ContactsClient({ contacts }: { contacts: Contact[] }) {
  const [search, setSearch] = useState('')
  const [buyer, setBuyer] = useState<'all' | 'buyers' | 'leads'>('all')
  const [seg, setSeg] = useState<Segment | 'all'>('all')
  const [source, setSource] = useState<string>('all')
  const [resellerOnly, setResellerOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const PAGE_SIZE = 50

  const filtered = useMemo(() => {
    let list = contacts
    if (buyer === 'buyers') list = list.filter(c => c.order_count > 0)
    else if (buyer === 'leads') list = list.filter(c => c.order_count === 0)
    if (seg !== 'all') list = list.filter(c => c.segment === seg)
    if (source !== 'all') list = list.filter(c => c.sources?.includes(source))
    if (resellerOnly) list = list.filter(c => c.is_reseller)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(c => (c.name ?? '').toLowerCase().includes(q) || c.phone_norm.includes(q.replace(/\D/g, '')) || (c.email ?? '').toLowerCase().includes(q))
    // Lead (belum beli) → susun paling baru dulu untuk follow-up; selain itu kekal (spend desc)
    if (buyer === 'leads') list = [...list].sort((a, b) => new Date(b.first_seen_at ?? 0).getTime() - new Date(a.first_seen_at ?? 0).getTime())
    return list
  }, [contacts, buyer, seg, source, resellerOnly, search])

  // Reset ke page 1 bila tapisan berubah
  useEffect(() => { setPage(1) }, [buyer, seg, source, resellerOnly, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = useMemo(() => ({
    total: contacts.length,
    withOrders: contacts.filter(c => c.order_count > 0).length,
    leads: contacts.filter(c => c.order_count === 0).length,
    resellers: contacts.filter(c => c.is_reseller).length,
  }), [contacts])

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Users className="h-5 w-5 text-gray-700" /> All Contacts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Master CRM — semua kenalan disatukan ikut telefon</p>
        </div>
        <button onClick={() => setBroadcastOpen(true)}
          className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-3.5 py-2 rounded-xl shadow-sm">
          <Send className="h-4 w-4" /> Broadcast
        </button>
      </div>

      {/* Stats = penapis utama (klik untuk asingkan pelanggan vs lead) */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { key: 'all',    label: 'Semua',    value: stats.total,     active: buyer === 'all' && !resellerOnly, onClick: () => { setBuyer('all'); setResellerOnly(false) }, accent: 'text-gray-900' },
          { key: 'buyers', label: 'Pelanggan', value: stats.withOrders, active: buyer === 'buyers', onClick: () => { setBuyer('buyers'); setResellerOnly(false) }, accent: 'text-green-600' },
          { key: 'leads',  label: 'Lead (belum beli)', value: stats.leads, active: buyer === 'leads', onClick: () => { setBuyer('leads'); setResellerOnly(false) }, accent: 'text-amber-600' },
          { key: 'reseller', label: 'Reseller', value: stats.resellers, active: resellerOnly, onClick: () => { setResellerOnly(v => !v); setBuyer('all') }, accent: 'text-rose-600' },
        ].map(s => (
          <button key={s.key} onClick={s.onClick}
            className={`text-left bg-white border rounded-2xl px-4 py-3 shadow-sm transition-all ${s.active ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100 hover:border-gray-300'}`}>
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-xl font-black mt-0.5 ${s.active ? s.accent : 'text-gray-900'}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, telefon, email…" className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-300" />
          </div>
          <select value={source} onChange={e => setSource(e.target.value)} className="py-2.5 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50">
            <option value="all">Semua sumber</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setResellerOnly(v => !v)} className={`px-3 py-2.5 text-sm font-semibold rounded-xl border ${resellerOnly ? 'bg-rose-600 text-white border-rose-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            Reseller
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {SEGMENT_ORDER.map(s => {
            const active = seg === s
            const cfg = s === 'all' ? null : SEGMENT_CONFIG[s]
            const count = s === 'all' ? contacts.length : contacts.filter(c => c.segment === s).length
            return (
              <button key={s} onClick={() => setSeg(s)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                {cfg ? `${cfg.emoji} ${cfg.label}` : 'Semua'} <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-2">
        {filtered.length === 0 ? '0 kenalan'
          : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} daripada ${filtered.length}`}
      </p>

      {/* List */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-50">
        {pageItems.map(c => (
          <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
            <div className="h-9 w-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">{(c.name ?? '?').charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-gray-900 text-sm truncate">{c.name ?? '—'}</p>
                {c.is_reseller && <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">RESELLER</span>}
              </div>
              <p className="text-xs text-gray-400 truncate">{c.phone_norm}{c.email ? ` · ${c.email}` : ''}</p>
              <div className="flex gap-1 mt-1 flex-wrap">
                {(c.sources ?? []).map(s => <span key={s} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${SOURCE_STYLE[s] ?? 'bg-gray-100 text-gray-500'}`}>{s}</span>)}
                {(c.tags ?? []).map(t => <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">#{t}</span>)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-gray-900 text-sm">RM{Number(c.total_spend).toFixed(0)}</p>
              <p className="text-xs text-gray-400">{c.order_count} order</p>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-400 py-10 text-center">Tiada kenalan sepadan.</p>}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹ Sebelum</button>
          <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Seterusnya ›</button>
        </div>
      )}

      {openId && <ContactDrawer id={openId} onClose={() => setOpenId(null)} />}
      {broadcastOpen && <BroadcastDrawer audience={filtered} onClose={() => setBroadcastOpen(false)} />}
    </div>
  )
}

const CAP = { wa: 200, email: 500 } as const

function BroadcastDrawer({ audience, onClose }: { audience: Contact[]; onClose: () => void }) {
  const [channel, setChannel] = useState<'wa' | 'email'>('wa')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [includeNonOptin, setIncludeNonOptin] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null)

  // Kira kelayakan ikut channel: ada saluran (phone/email) + (opt-in ATAU override)
  const counts = useMemo(() => {
    const hasChannel = (c: Contact) => channel === 'wa' ? !!c.phone_norm : !!c.email
    const hasConsent = (c: Contact) => channel === 'wa' ? c.consent_wa === true : c.consent_email === true
    const reachable = audience.filter(hasChannel)
    const optIn = reachable.filter(hasConsent)
    return { optIn: optIn.length, all: reachable.length, noChannel: audience.length - reachable.length }
  }, [audience, channel])

  const recipients = includeNonOptin ? counts.all : counts.optIn
  const cap = CAP[channel]
  const overCap = recipients > cap

  async function handleSend() {
    if (!message.trim()) return toast.error('Tulis mesej dahulu')
    if (channel === 'email' && !subject.trim()) return toast.error('Isi subject untuk email')
    if (!recipients) return toast.error('Tiada penerima layak')
    if (overCap) return toast.error(`Had ${cap} penerima — tapis lebih kecil`)
    if (!confirm(`Hantar ${channel === 'wa' ? 'WhatsApp' : 'Email'} ke ${recipients} penerima? Tindakan ini tidak boleh dibatalkan.`)) return

    setSending(true); setResult(null)
    const res = await fetch('/api/admin/customers/broadcast', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: audience.map(c => c.id), channel, subject, message, includeNonOptin }),
    })
    setSending(false)
    if (!res.ok) { toast.error((await res.json().catch(() => ({})))?.error ?? 'Gagal hantar'); return }
    const data = await res.json()
    setResult(data)
    toast.success(`Berjaya hantar ke ${data.sent} penerima`)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><Send className="h-4 w-4 text-green-600" /> Broadcast</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">Hantar ke {audience.length} kenalan dalam tapisan semasa.</p>

        {/* Channel */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {([
            { val: 'wa' as const, label: 'WhatsApp', icon: MessageSquare },
            { val: 'email' as const, label: 'Email', icon: Mail },
          ]).map(({ val, label, icon: Icon }) => (
            <button key={val} onClick={() => { setChannel(val); setResult(null) }}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${channel === val ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* Subject (email) */}
        {channel === 'email' && (
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject email…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 mb-3 focus:outline-none focus:ring-2 focus:ring-green-300" />
        )}

        {/* Mesej */}
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6}
          placeholder={`Hai {nama}! 👋\n\nKami ada tawaran istimewa untuk anda hari ini…`}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-green-300" />
        <p className="text-xs text-gray-400 mt-1 mb-3">Guna <code className="bg-gray-100 px-1 rounded">{'{nama}'}</code> untuk nama penerima</p>

        {/* Opt-in / override */}
        <label className="flex items-start gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={includeNonOptin} onChange={e => setIncludeNonOptin(e.target.checked)} className="mt-0.5 rounded text-red-500 focus:ring-red-400" />
          <span className="text-xs text-gray-600">
            Masukkan semua dalam tapisan (abai opt-in)
            <span className="block text-[11px] text-gray-400">{counts.optIn} opt-in → {counts.all} semua{counts.noChannel ? ` · ${counts.noChannel} tiada ${channel === 'wa' ? 'no. telefon' : 'email'}` : ''}</span>
          </span>
        </label>
        {includeNonOptin && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-[11px] text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Hantar ke penerima tanpa kebenaran berisiko {channel === 'wa' ? 'WhatsApp diban' : 'aduan spam'}. Pastikan ada sebab yang sah.</span>
          </div>
        )}

        {/* Ringkasan + hantar */}
        <div className="flex items-center justify-between border-t border-gray-50 pt-3 mb-3">
          <p className="text-sm font-bold text-gray-900">{recipients} penerima</p>
          {overCap && <p className="text-[11px] font-semibold text-red-500">Lebih had {cap}</p>}
        </div>
        <button onClick={handleSend} disabled={sending || !message.trim() || !recipients || overCap}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-2xl disabled:opacity-50 hover:bg-green-700 transition-colors">
          {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Menghantar…</> : <><Send className="h-4 w-4" /> Hantar ke {recipients} penerima</>}
        </button>

        {result && (
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="bg-green-50 rounded-xl p-3"><p className="text-lg font-black text-green-600">{result.sent}</p><p className="text-[11px] text-gray-500">Berjaya</p></div>
            <div className="bg-red-50 rounded-xl p-3"><p className="text-lg font-black text-red-500">{result.failed}</p><p className="text-[11px] text-gray-500">Gagal</p></div>
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-lg font-black text-gray-600">{result.skipped}</p><p className="text-[11px] text-gray-500">Dilangkau</p></div>
          </div>
        )}
      </div>
    </div>
  )
}

function ContactDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ customer: any; notes: Note[]; reseller: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [newTag, setNewTag] = useState('')
  const [newNote, setNewNote] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/customers/${id}`).then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  const c = data?.customer

  async function saveTags(tags: string[]) {
    const res = await fetch(`/api/admin/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) })
    if (!res.ok) { toast.error('Gagal'); return }
    setData(d => d ? { ...d, customer: { ...d.customer, tags } } : d)
  }
  function addTag() { const t = newTag.trim(); if (!t) return; const tags = [...new Set([...(c.tags ?? []), t])]; setNewTag(''); saveTags(tags) }
  function removeTag(t: string) { saveTags((c.tags ?? []).filter((x: string) => x !== t)) }

  async function addNote() {
    const body = newNote.trim(); if (!body) return
    const res = await fetch(`/api/admin/customers/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) })
    if (!res.ok) { toast.error('Gagal'); return }
    const note = await res.json(); setNewNote('')
    setData(d => d ? { ...d, notes: [note, ...d.notes] } : d)
  }

  async function makeReseller() {
    const res = await fetch('/api/admin/resellers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: id }) })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Gagal'); return }
    toast.success('Jadi reseller'); setData(d => d ? { ...d, customer: { ...d.customer, is_reseller: true }, reseller: { status: 'active' } } : d)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Detail Kenalan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        {loading && <p className="text-sm text-gray-400">Memuatkan…</p>}
        {c && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-gray-900">{c.name ?? '—'}</p>
                {c.is_reseller && <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">RESELLER</span>}
              </div>
              <p className="text-sm text-gray-500">{c.phone_norm}</p>
              {c.email && <p className="text-sm text-gray-500">{c.email}</p>}
              {c.address && <p className="text-xs text-gray-400 mt-1">{c.address}</p>}
              <p className="text-xs text-gray-400 mt-2">{c.order_count} order · RM{Number(c.total_spend).toFixed(2)} · sumber: {(c.sources ?? []).join(', ')}</p>
            </div>

            {/* Tags */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1"><TagIcon className="h-3.5 w-3.5" /> Tags</p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {(c.tags ?? []).map((t: string) => (
                  <span key={t} className="text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 flex items-center gap-1">#{t}<button onClick={() => removeTag(t)} className="hover:text-indigo-900"><X className="h-3 w-3" /></button></span>
                ))}
                {(c.tags ?? []).length === 0 && <span className="text-xs text-gray-400">Tiada tag</span>}
              </div>
              <div className="flex gap-2">
                <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Tambah tag…" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
                <button onClick={addTag} className="text-sm font-semibold text-white bg-indigo-600 px-3 rounded-lg hover:bg-indigo-700"><Plus className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Reseller */}
            {!c.is_reseller && (
              <button onClick={makeReseller} className="flex items-center gap-1.5 text-sm font-semibold text-rose-600 border border-rose-200 bg-rose-50 px-3 py-2 rounded-xl hover:bg-rose-100 w-full justify-center">
                <Store className="h-4 w-4" /> Jadikan Reseller
              </button>
            )}

            {/* Notes */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1"><StickyNote className="h-3.5 w-3.5" /> Nota</p>
              <div className="flex gap-2 mb-3">
                <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="Tulis nota…" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
                <button onClick={addNote} className="text-sm font-semibold text-white bg-gray-900 px-3 rounded-lg hover:bg-gray-800">Hantar</button>
              </div>
              <div className="space-y-2">
                {(data?.notes ?? []).map(n => (
                  <div key={n.id} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-700">{n.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{n.author ?? 'admin'} · {new Date(n.created_at).toLocaleString('ms-MY')}</p>
                  </div>
                ))}
                {(data?.notes ?? []).length === 0 && <p className="text-xs text-gray-400">Belum ada nota.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
