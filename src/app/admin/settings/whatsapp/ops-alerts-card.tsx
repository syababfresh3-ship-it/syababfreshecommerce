'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Loader2, RefreshCw, Save, Send } from 'lucide-react'

// Kad "Amaran operasi" — hantar peristiwa dalaman (COD menunggu kelulusan, bayaran gagal,
// cron senyap, stok rendah) ke satu kumpulan WhatsApp staf melalui nombor gateway (lib/ops-alerts).
// API: /api/admin/ops-alerts (GET tetapan+nombor+kumpulan · PATCH simpan · POST ujian).

interface Kind { key: string; label: string; desc: string }
interface SessionOpt { sessionId: string; label: string }
interface GroupOpt { jid: string; name: string; size: number | null }
interface Loaded {
  config: { enabled: boolean; sessionId: string; groupJid: string; groupName: string; kinds: string[]; lowStock: number; stockInCost: boolean }
  kinds: Kind[]
  sessions: SessionOpt[]
  groups: GroupOpt[]
  groupsError: string | null
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white'

export function OpsAlertsCard() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [kinds, setKinds] = useState<Kind[]>([])
  const [sessions, setSessions] = useState<SessionOpt[]>([])
  const [groups, setGroups] = useState<GroupOpt[]>([])
  const [groupsError, setGroupsError] = useState<string | null>(null)

  const [enabled, setEnabled] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [groupJid, setGroupJid] = useState('')
  const [groupName, setGroupName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [lowStock, setLowStock] = useState('5')
  const [stockInCost, setStockInCost] = useState(true)

  const load = useCallback(async (session?: string) => {
    const url = session ? `/api/admin/ops-alerts?session=${encodeURIComponent(session)}` : '/api/admin/ops-alerts'
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
    return (await res.json()) as Loaded
  }, [])

  useEffect(() => {
    load()
      .then(d => {
        setKinds(d.kinds); setSessions(d.sessions); setGroups(d.groups); setGroupsError(d.groupsError)
        setEnabled(d.config.enabled); setSessionId(d.config.sessionId); setGroupJid(d.config.groupJid)
        setGroupName(d.config.groupName); setPicked(d.config.kinds); setLowStock(String(d.config.lowStock)); setStockInCost(d.config.stockInCost !== false)
      })
      .catch(e => toast.error(`Gagal muat tetapan amaran: ${e.message}`))
      .finally(() => setLoading(false))
  }, [load])

  async function refreshGroups(session: string) {
    if (!session) { setGroups([]); return }
    setLoadingGroups(true)
    try {
      const d = await load(session)
      setGroups(d.groups); setGroupsError(d.groupsError)
    } catch (e) {
      setGroupsError((e as Error).message)
    } finally { setLoadingGroups(false) }
  }

  function pickSession(v: string) {
    setSessionId(v); setGroupJid(''); setGroupName('')
    void refreshGroups(v)
  }
  function pickGroup(jid: string) {
    setGroupJid(jid)
    setGroupName(groups.find(g => g.jid === jid)?.name ?? '')
  }
  const toggleKind = (k: string) => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ops-alerts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, sessionId, groupJid, groupName, kinds: picked, lowStock, stockInCost }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error || 'Gagal simpan'); return }
      toast.success('Tetapan amaran operasi disimpan')
    } finally { setSaving(false) }
  }

  async function sendTest() {
    if (!sessionId || !groupJid) { toast.error('Pilih nombor dan kumpulan dahulu.'); return }
    setTesting(true)
    try {
      const res = await fetch('/api/admin/ops-alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', sessionId, groupJid }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { toast.error(j.error || 'Gagal hantar ujian'); return }
      toast.success('Mesej ujian dihantar ke kumpulan')
    } finally { setTesting(false) }
  }

  const ready = !!sessionId && !!groupJid

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 flex items-center gap-2"><Bell className="h-4 w-4 text-gray-500" />Amaran operasi ke kumpulan staf</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Peristiwa dalaman dihantar melalui nombor gateway (bukan Official) ke satu kumpulan WhatsApp yang disertai nombor itu.
            Dihantar melalui baris gilir WA, sampai dalam 5 minit.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(v => !v)}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-gray-800' : 'bg-gray-200'} disabled:opacity-50`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 mt-4 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Memuatkan…</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Hantar dari nombor</label>
              <select className={`${inputCls} mt-1`} value={sessionId} onChange={e => pickSession(e.target.value)}>
                <option value="">Pilih nombor gateway</option>
                {sessions.map(s => <option key={s.sessionId} value={s.sessionId}>{s.label}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Senarai dari Tetapan nombor WA (nombor gw: yang aktif).</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600">Kumpulan sasaran</label>
                <button type="button" onClick={() => refreshGroups(sessionId)} disabled={!sessionId || loadingGroups}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 disabled:opacity-40">
                  <RefreshCw className={`h-3 w-3 ${loadingGroups ? 'animate-spin' : ''}`} />Muat semula
                </button>
              </div>
              <select className={`${inputCls} mt-1`} value={groupJid} onChange={e => pickGroup(e.target.value)} disabled={!sessionId}>
                <option value="">{sessionId ? (groups.length ? 'Pilih kumpulan' : 'Tiada kumpulan dimuatkan') : 'Pilih nombor dahulu'}</option>
                {groups.map(g => <option key={g.jid} value={g.jid}>{g.name}{g.size != null ? ` · ${g.size} ahli` : ''}</option>)}
                {groupJid && !groups.some(g => g.jid === groupJid) && <option value={groupJid}>{groupName || groupJid} (tersimpan)</option>}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">{groupsError ? `Gagal muat kumpulan: ${groupsError}` : 'Hanya kumpulan yang disertai nombor itu.'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Jenis amaran</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {kinds.map(k => (
                <label key={k.key} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer ${picked.includes(k.key) ? 'border-gray-800 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="checkbox" className="mt-0.5 accent-gray-800" checked={picked.includes(k.key)} onChange={() => toggleKind(k.key)} />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{k.label}</span>
                    <span className="block text-[11px] text-gray-500">{k.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className="text-xs font-semibold text-gray-600">Ambang stok rendah</label>
              <input type="number" min={0} max={1000} value={lowStock} onChange={e => setLowStock(e.target.value.replace(/\D/g, ''))} className={`${inputCls} mt-1`} />
            </div>
            <p className="text-[11px] text-gray-400 pb-2">Stok rendah diulang setiap 24 jam bagi setiap produk; cron senyap setiap 6 jam bagi setiap job.</p>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-gray-800" checked={stockInCost} onChange={e => setStockInCost(e.target.checked)} />
            <span>Sertakan harga dan kos belian dalam mesej buah baru masuk<span className="block text-[11px] text-gray-500">Matikan kalau kumpulan ada orang yang tak patut nampak kos belian.</span></span>
          </label>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Simpan
            </button>
            <button onClick={sendTest} disabled={testing || !ready}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-800 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Uji hantar
            </button>
            {enabled && !ready && <span className="text-[11px] text-gray-500">Pilih nombor dan kumpulan sebelum simpan dengan suis hidup.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
