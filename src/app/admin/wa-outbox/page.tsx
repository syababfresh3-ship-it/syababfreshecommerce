'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Clock, CheckCircle2, XCircle, Send, RotateCcw, Smartphone, Wifi, WifiOff } from 'lucide-react'

interface Session {
  session_id: string
  phone_number?: string
  device_name?: string
  status?: string // connected|disconnected|pending|expired|not_found
  push_name?: string
  in_pool?: boolean
}

interface Row {
  id: string
  phone: string
  source: string
  status: 'pending' | 'sent' | 'failed'
  scheduled_at: string
  attempts: number
  last_error: string | null
  session_id: string | null
  sent_at: string | null
  created_at: string
}
interface Counts { pending: number; sent: number; failed: number; due: number }

type Filter = '' | 'pending' | 'sent' | 'failed'

const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

const STATUS_BADGE: Record<Row['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  sent: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
}

export default function WaOutboxPage() {
  const [counts, setCounts] = useState<Counts>({ pending: 0, sent: 0, failed: 0, due: 0 })
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('')
  const [busy, setBusy] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessLoading, setSessLoading] = useState(true)
  const [sessError, setSessError] = useState<string | null>(null)

  // Status nombor jarang berubah & makan kuota API — muat masa mount + refresh sahaja
  const loadSessions = useCallback(async () => {
    setSessLoading(true)
    try {
      const res = await fetch('/api/admin/wa-sessions')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal muat')
      setSessions(json.sessions ?? [])
      setSessError(json.ok ? null : json.error)
    } catch (e) {
      setSessError(e instanceof Error ? e.message : 'Gagal muat')
    } finally {
      setSessLoading(false)
    }
  }, [])

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await fetch(`/api/admin/wa-outbox${filter ? `?status=${filter}` : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal muat')
      setCounts(json.counts)
      setRows(json.rows)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal muat')
    } finally {
      setLoading(false)
    }
  }, [filter])

  // Muat semula bila tukar filter + auto-refresh tiap 15s
  useEffect(() => {
    load(true)
    const iv = setInterval(() => load(false), 15_000)
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => { loadSessions() }, [loadSessions])

  async function retry(id: string) {
    setBusy(id)
    const res = await fetch('/api/admin/wa-outbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry', id }),
    })
    if (res.ok) { toast.success('Dijadual semula'); await load() }
    else toast.error('Gagal retry')
    setBusy(null)
  }

  async function retryAllFailed() {
    if (!confirm(`Cuba semula ${counts.failed} mesej gagal?`)) return
    setBusy('all')
    const res = await fetch('/api/admin/wa-outbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry_failed' }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) { toast.success(`${json.retried ?? 0} dijadual semula`); await load() }
    else toast.error('Gagal retry')
    setBusy(null)
  }

  const cards = [
    { key: 'pending' as const, label: 'Pending', value: counts.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', sub: `${counts.due} sedia hantar` },
    { key: 'sent' as const, label: 'Sent', value: counts.sent, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
    { key: 'failed' as const, label: 'Failed', value: counts.failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Send className="h-5 w-5 text-gray-500" /> WA Outbox
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Gilir mesej WhatsApp tracking — dipacing oleh cron drainer.</p>
        </div>
        <div className="flex gap-2">
          {counts.failed > 0 && (
            <button
              onClick={retryAllFailed}
              disabled={busy === 'all'}
              className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {busy === 'all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Retry semua gagal
            </button>
          )}
          <button
            onClick={() => { load(true); loadSessions() }}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Status nombor WhatsApp (send pool) ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Smartphone className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-bold text-gray-700">Nombor WhatsApp</h2>
          {sessLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />}
        </div>
        {sessError ? (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{sessError}</p>
        ) : sessions.length === 0 && !sessLoading ? (
          <p className="text-xs text-gray-400">Tiada session. Set <code className="font-mono">MURPATI_SESSION_IDS</code> di Vercel.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sessions.map((s) => {
              const connected = s.status === 'connected'
              const missing = s.status === 'not_found'
              return (
                <div key={s.session_id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${connected ? 'bg-green-100' : missing ? 'bg-gray-100' : 'bg-amber-100'}`}>
                    {connected ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className={`h-4 w-4 ${missing ? 'text-gray-400' : 'text-amber-600'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
                      {s.phone_number ?? s.device_name ?? s.session_id}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {s.device_name ?? s.push_name ?? '—'}
                      {s.in_pool && <span className="ml-1 text-indigo-500 font-medium">• send pool</span>}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                    connected ? 'bg-green-50 text-green-700 border-green-200'
                      : missing ? 'bg-gray-50 text-gray-400 border-gray-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {missing ? 'tak dijumpai' : (s.status ?? 'unknown')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stat cards — klik untuk tapis */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter((f) => (f === c.key ? '' : c.key))}
            className={`bg-white rounded-2xl border shadow-sm p-4 text-left transition-all ${
              filter === c.key ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 leading-none">{c.value}</p>
                <p className="text-xs text-gray-400 mt-1">{c.label}</p>
              </div>
            </div>
            {c.sub && <p className="text-[11px] text-amber-600 mt-2 font-medium">{c.sub}</p>}
          </button>
        ))}
      </div>

      {filter && (
        <button onClick={() => setFilter('')} className="text-xs text-gray-500 hover:text-gray-800 mb-3 inline-flex items-center gap-1">
          ← Tunjuk semua
        </button>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Tiada mesej{filter ? ` berstatus "${filter}"` : ''}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Phone</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Jadual</th>
                  <th className="text-left px-4 py-3">Hantar</th>
                  <th className="text-center px-4 py-3">Cuba</th>
                  <th className="w-16 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3">
                      <span className="font-mono text-gray-700">{r.phone}</span>
                      <span className="block text-[11px] text-gray-400 mt-0.5">{r.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${STATUS_BADGE[r.status]}`}>
                        {r.status}
                      </span>
                      {r.status === 'failed' && r.last_error && (
                        <span className="block text-[11px] text-red-500 mt-1 max-w-[220px] truncate" title={r.last_error}>
                          {r.last_error}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(r.scheduled_at)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(r.sent_at)}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{r.attempts}</td>
                    <td className="px-4 py-3">
                      {r.status !== 'sent' && (
                        <button
                          onClick={() => retry(r.id)}
                          disabled={busy === r.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                          title="Cuba semula sekarang"
                        >
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
