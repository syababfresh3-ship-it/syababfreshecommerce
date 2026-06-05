'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Headset, AlertCircle, CheckCircle2, Inbox, ChevronDown, ChevronUp, X, MessageCircle } from 'lucide-react'

interface Row {
  id: string
  created_at: string
  order_kind: string
  order_number: string
  customer_name: string | null
  customer_phone: string | null
  category: string | null
  status: string
  ai_summary: string | null
  image_urls: string[]
  damage_items: DamageItem[]
}
interface DamageItem { item: string; qty_ordered?: number; calc?: string; rosak_qty?: number; percent_rosak?: number }
interface Msg { role: string; content: string; created_at: string }
interface Counts { open: number; escalated: number; resolved: number }

type Filter = '' | 'open' | 'escalated' | 'resolved'

const fmt = (s: string) => new Date(s).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-gray-50 text-gray-600 border-gray-200',
  escalated: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-50 text-gray-400 border-gray-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

export default function SupportPage() {
  const [counts, setCounts] = useState<Counts>({ open: 0, escalated: 0, resolved: 0 })
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async (spin = false) => {
    if (spin) setLoading(true)
    try {
      const res = await fetch(`/api/admin/support${filter ? `?status=${filter}` : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal muat')
      setCounts(json.counts); setRows(json.rows)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal muat') }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => {
    load(true)
    const iv = setInterval(() => load(false), 20_000)
    return () => clearInterval(iv)
  }, [load])

  async function openDetail(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id); setLoadingMsgs(true); setMessages([])
    try {
      const res = await fetch(`/api/admin/support?id=${id}`)
      const json = await res.json()
      if (res.ok) setMessages(json.messages ?? [])
    } finally { setLoadingMsgs(false) }
  }

  async function setStatus(id: string, status: string) {
    setBusy(id)
    const res = await fetch('/api/admin/support', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) { toast.success('Dikemas kini'); await load() } else toast.error('Gagal')
    setBusy(null)
  }

  const cards = [
    { key: 'escalated' as const, label: 'Perlu CS', value: counts.escalated, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
    { key: 'open' as const, label: 'Sedang chat', value: counts.open, icon: Inbox, color: 'text-gray-600', bg: 'bg-gray-100' },
    { key: 'resolved' as const, label: 'Selesai', value: counts.resolved, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Headset className="h-5 w-5 text-gray-500" /> Support AI</h1>
          <p className="text-sm text-gray-400 mt-0.5">Aduan pelanggan dari /bantuan — AI intake, CS susuli.</p>
        </div>
        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {cards.map((c) => (
          <button key={c.key} onClick={() => setFilter((f) => (f === c.key ? '' : c.key))}
            className={`bg-white rounded-2xl border shadow-sm p-4 text-left transition-all ${filter === c.key ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100 hover:border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${c.bg}`}><c.icon className={`h-4 w-4 ${c.color}`} /></div>
              <div className="min-w-0"><p className="text-2xl font-bold text-gray-900 leading-none">{c.value}</p><p className="text-xs text-gray-400 mt-1">{c.label}</p></div>
            </div>
          </button>
        ))}
      </div>

      {filter && <button onClick={() => setFilter('')} className="text-xs text-gray-500 hover:text-gray-800 mb-3">← Tunjuk semua</button>}

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">Tiada aduan{filter ? ` berstatus "${filter}"` : ''}.</div>
        ) : rows.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50" onClick={() => openDetail(r.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">{r.order_number}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_BADGE[r.status] ?? STATUS_BADGE.open}`}>{r.status}</span>
                  {r.category && <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">{r.category}</span>}
                  {r.image_urls?.length > 0 && <span className="text-[11px] text-gray-400">📷 {r.image_urls.length}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{r.customer_name ?? 'Pelanggan'} · {r.customer_phone ?? '—'} · {fmt(r.created_at)}</p>
                {r.ai_summary && <p className="text-sm text-gray-700 mt-1.5 line-clamp-2">{r.ai_summary}</p>}
              </div>
              {expanded === r.id ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
            </div>

            {expanded === r.id && (
              <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
                {/* Hubungi customer terus (WhatsApp peribadi admin — tiada risiko ban) */}
                {r.customer_phone && (
                  <a href={`https://wa.me/${r.customer_phone}?text=${encodeURIComponent(`Hai ${r.customer_name ?? ''}, ini CS SyababFresh tentang aduan pesanan ${r.order_number}. Boleh kami bantu selesaikan? 🌿`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-600 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-green-700 transition-colors">
                    <MessageCircle className="h-4 w-4" /> WhatsApp customer ({r.customer_phone})
                  </a>
                )}
                {r.damage_items?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Item rosak (untuk refund)</p>
                    <div className="space-y-1">
                      {r.damage_items.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-gray-800 font-medium">{d.item}</span>
                          <span className="text-gray-500 text-xs">
                            {d.calc === 'peratus'
                              ? `${d.percent_rosak ?? '?'}% rosak`
                              : `${d.rosak_qty ?? '?'} rosak${d.qty_ordered ? ` / ${d.qty_ordered} dipesan` : ''}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {r.image_urls?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {r.image_urls.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="bukti" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {loadingMsgs ? <Loader2 className="h-4 w-4 animate-spin text-gray-300 mx-auto" /> :
                    messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-red-600 text-white' : 'bg-white border border-gray-100 text-gray-800'}`}>{m.content}</div>
                      </div>
                    ))}
                </div>
                {/* Status mudah — refund sebenar diuruskan via WhatsApp + page refund */}
                <div className="flex gap-2 pt-1">
                  {r.status !== 'resolved' && (
                    <button onClick={() => setStatus(r.id, 'resolved')} disabled={busy === r.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50">
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Tanda selesai
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button onClick={() => setStatus(r.id, 'rejected')} disabled={busy === r.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                      <X className="h-3.5 w-3.5" /> Tolak
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
