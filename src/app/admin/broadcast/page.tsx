'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Send, Users, MessageSquare, CheckCircle2, AlertCircle,
  MapPin, Clock, UserCheck, Search, X, ChevronDown, ChevronUp,
} from 'lucide-react'

const MY_STATES = [
  'Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya',
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Terengganu',
  'W.P. Labuan',
]

type FilterMode = 'all' | 'state' | 'activity' | 'manual'
type ActivityType = 'inactive' | 'active' | 'never'
interface Recipient { id: string; full_name: string | null; phone: string }
interface Result { sent: number; failed: number; total: number }

export default function BroadcastPage() {
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [activityDays, setActivityDays] = useState(30)
  const [activityType, setActivityType] = useState<ActivityType>('inactive')
  const [manualSearch, setManualSearch] = useState('')
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [previewList, setPreviewList] = useState<Recipient[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  // Load all opt-in customers for manual picker
  useEffect(() => {
    if (filterMode === 'manual') {
      setLoadingRecipients(true)
      fetch('/api/admin/broadcast?preview=1&filter=all')
        .then(r => r.json())
        .then(d => { setAllRecipients(d.recipients ?? []); setLoadingRecipients(false) })
    }
  }, [filterMode])

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ filter: filterMode })
    if (filterMode === 'state') p.set('states', selectedStates.join(','))
    if (filterMode === 'activity') { p.set('days', String(activityDays)); p.set('activityType', activityType) }
    if (filterMode === 'manual') p.set('ids', [...selectedIds].join(','))
    return p
  }, [filterMode, selectedStates, activityDays, activityType, selectedIds])

  // Count recipients when filter changes
  useEffect(() => {
    if (filterMode === 'manual') { setRecipientCount(selectedIds.size); return }
    if (filterMode === 'state' && selectedStates.length === 0) { setRecipientCount(0); return }
    setRecipientCount(null)
    const params = buildParams()
    fetch(`/api/admin/broadcast?${params}`)
      .then(r => r.json())
      .then(d => setRecipientCount(d.count ?? 0))
  }, [filterMode, selectedStates, activityDays, activityType, buildParams, selectedIds])

  async function loadPreview() {
    setLoadingRecipients(true)
    setShowPreview(true)
    const params = buildParams()
    params.set('preview', '1')
    const d = await fetch(`/api/admin/broadcast?${params}`).then(r => r.json())
    setPreviewList(d.recipients ?? [])
    setLoadingRecipients(false)
  }

  async function handleSend() {
    if (!message.trim()) return toast.error('Tulis mesej dahulu')
    if (!recipientCount) return toast.error('No penerima diselect')
    if (!confirm(`Send ke ${recipientCount} penerima? Tindakan ini tidak boleh dibatalkan.`)) return

    setSending(true)
    setResult(null)

    const body: Record<string, unknown> = { message, filter: filterMode }
    if (filterMode === 'state') body.states = selectedStates
    if (filterMode === 'activity') { body.activityDays = activityDays; body.activityType = activityType }
    if (filterMode === 'manual') body.manualIds = [...selectedIds]

    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSending(false)
    if (res.ok) {
      const data = await res.json()
      setResult(data)
      toast.success(`Success send ke ${data.sent} penerima`)
    } else {
      toast.error('Failed send broadcast')
    }
  }

  function toggleState(s: string) {
    setSelectedStates(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredManual = allRecipients.filter(r =>
    !manualSearch || r.full_name?.toLowerCase().includes(manualSearch.toLowerCase()) || r.phone.includes(manualSearch)
  )

  const FILTER_TABS: { mode: FilterMode; label: string; icon: React.ElementType }[] = [
    { mode: 'all', label: 'All', icon: Users },
    { mode: 'state', label: 'Kawasan', icon: MapPin },
    { mode: 'activity', label: 'Aktiviti', icon: Clock },
    { mode: 'manual', label: 'Select Sendiri', icon: UserCheck },
  ]

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">WhatsApp Broadcast</h1>
        <p className="text-sm text-gray-500 mt-1">Send mesej ke customer yang opt-in WhatsApp marketing</p>
      </div>

      {/* Filter tabs */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <p className="text-sm font-bold text-gray-900">Select Penerima</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FILTER_TABS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => { setFilterMode(mode); setShowPreview(false); setResult(null) }}
              className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                filterMode === mode
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-100 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Filter: State */}
        {filterMode === 'state' && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500">Select negeri (boleh select berbilang):</p>
            <div className="flex flex-wrap gap-2">
              {MY_STATES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleState(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    selectedStates.includes(s)
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter: Activity */}
        {filterMode === 'activity' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { val: 'inactive', label: 'Tak active', sub: 'Tak order dalam X hari' },
                { val: 'active',   label: 'Active',     sub: 'Order dalam X hari' },
                { val: 'never',    label: 'Belum order', sub: 'Tak pernah buat orders' },
              ] as const).map(({ val, label, sub }) => (
                <button
                  key={val}
                  onClick={() => setActivityType(val)}
                  className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                    activityType === val
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-xs font-bold ${activityType === val ? 'text-green-700' : 'text-gray-700'}`}>{label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
            {activityType !== 'never' && (
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-600 shrink-0">Period:</p>
                <div className="flex gap-2 flex-wrap">
                  {[7, 14, 30, 60, 90].map(d => (
                    <button
                      key={d}
                      onClick={() => setActivityDays(d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        activityDays === d
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {d} hari
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter: Manual */}
        {filterMode === 'manual' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search nama atau no. phone..."
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                className="flex-1 text-sm focus:outline-none"
              />
              {manualSearch && (
                <button onClick={() => setManualSearch('')}><X className="h-3.5 w-3.5 text-gray-400" /></button>
              )}
            </div>
            {loadingRecipients ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
                {filteredManual.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No penerima</p>
                ) : filteredManual.map(r => (
                  <label key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleId(r.id)}
                      className="rounded text-green-500 focus:ring-green-400"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{r.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{r.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-green-700 font-semibold">{selectedIds.size} diselect</p>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Nyah select all</button>
              </div>
            )}
          </div>
        )}

        {/* Recipient count + preview */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {recipientCount === null ? (
                  <span className="text-gray-400">Mengira...</span>
                ) : `${recipientCount} penerima`}
              </p>
              <p className="text-xs text-gray-400">Akan menerima mesej ini</p>
            </div>
          </div>
          {filterMode !== 'manual' && (
            <button
              onClick={loadPreview}
              className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700 transition-colors"
            >
              {showPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showPreview ? 'Sembunyikan' : 'Lihat senarai'}
            </button>
          )}
        </div>

        {/* Preview list */}
        {showPreview && filterMode !== 'manual' && (
          <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
            {loadingRecipients ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-gray-300" /></div>
            ) : previewList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No penerima untuk filter ini</p>
            ) : previewList.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                  {(r.full_name ?? r.phone)[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{r.full_name ?? '—'}</p>
                  <p className="text-[10px] text-gray-400">{r.phone}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-bold text-gray-900">Tulis Mesej</h2>
        </div>
        <div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            placeholder={`Hai {nama}! 👋\n\nKami ada tawaran istimewa untuk anda hari ini...`}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-400">Guna <code className="bg-gray-100 px-1 rounded">{'{nama}'}</code> untuk nama customer</p>
            <p className={`text-xs font-medium ${message.length > 900 ? 'text-red-500' : 'text-gray-400'}`}>{message.length} / 1000</p>
          </div>
        </div>
        {message && (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview (Ahmad)</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
              {message.replace(/\{nama\}/gi, 'Ahmad')}
            </p>
          </div>
        )}
        <button
          onClick={handleSend}
          disabled={sending || !message.trim() || !recipientCount}
          className="w-full flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60 hover:bg-green-600 transition-colors"
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Mengsend... ({recipientCount} penerima)</>
          ) : (
            <><Send className="h-4 w-4" />Send ke {recipientCount ?? '—'} penerima</>
          )}
        </button>
        {sending && <p className="text-xs text-center text-gray-400">Please tunggu — mengsend satu persatu untuk elak spam</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Keputusan Broadcast</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-xl p-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
              <p className="text-lg font-black text-green-600">{result.sent}</p>
              <p className="text-xs text-gray-500">Success</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <AlertCircle className="h-5 w-5 text-red-400 mx-auto mb-1" />
              <p className="text-lg font-black text-red-500">{result.failed}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <Users className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-lg font-black text-gray-600">{result.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700 space-y-1.5">
        <p className="font-bold">Tips broadcast berkesan:</p>
        <p>• Send pada waktu pagi (8–10am) atau petang (4–6pm)</p>
        <p>• Masukkan tawaran yang jelas dan CTA (Call-to-Action)</p>
        <p>• Jangan send lebih dari 2x seminggu untuk elak diblock</p>
        <p>• Guna <code className="bg-amber-100 px-1 rounded">{'{nama}'}</code> untuk personalisasi — kadar buka lebih tinggi</p>
      </div>
    </div>
  )
}
