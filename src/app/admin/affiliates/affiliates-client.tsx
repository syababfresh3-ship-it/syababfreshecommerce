'use client'

// Admin → Affiliate (Melayu, monokrom, ikon lucide). Model produk-link:
//   • kadar komisen IKUT PRODUK (Products → "Komisen Affiliate (%)"), bukan kadar global
//   • klik pautan direkod pelayan (affiliate_clicks) → tetingkap attribution & kadar tukaran
//   • komisen tertahan N hari selepas delivered+dibayar, dikredit cron (affiliate_credit_due)
//   • pengeluaran ikut mesin keadaan dalam DB (pending → approved/rejected/paid; approved → paid/rejected)
// Migration 139 + 165.
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Users, Clock, CircleDollarSign, Settings2, ChevronDown, ChevronUp, Link2, Copy, Check, Search,
  Download, UserPlus, MessageSquare, MousePointerClick, ShieldCheck, Hourglass,
} from 'lucide-react'

export type AdminAffProfile = {
  id: string; full_name: string | null; email: string | null; phone: string | null
  is_affiliate: boolean; affiliate_balance: number; referral_code: string | null; created_at: string
}
export type AdminAffWithdrawal = {
  id: string; affiliate_id: string; amount: number; bank_name: string; bank_account: string; account_name: string
  status: string; admin_note: string | null; requested_at: string; processed_at: string | null
  affiliate: { full_name: string | null; email: string | null; phone: string | null } | null
}
export type AdminAffApplication = {
  id: string; user_id: string; status: string; message: string | null; admin_note: string | null; created_at: string
  applicant: { full_name: string | null; email: string | null; phone: string | null } | null
}
export type AdminAffAttr = {
  id: string; affiliateId: string; affiliateName: string | null; affiliateEmail: string | null
  source: 'order' | 'lp_guest'; orderId: string; orderNumber: string | null; lpSlug: string | null
  productName: string; gross: number; net: number; rate: number; amount: number
  status: 'pending' | 'credited' | 'reversed'; createdAt: string; clickedAt: string | null
  creditAfter: string | null; creditedAt: string | null; reversedReason: string | null
}
export type AdminAffData = {
  profiles: AdminAffProfile[]
  withdrawals: AdminAffWithdrawal[]
  applications: AdminAffApplication[]
  attributions: AdminAffAttr[]
  clicks30ByAff: Record<string, number>
  settings: { holdDays: number; windowDays: number; minWithdraw: number; notifyWa: boolean }
}

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis']
const rm = (n: number) => `RM${(Number(n) || 0).toFixed(2)}`
function dt(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return '—'
  const d = new Date(t + 8 * 3600_000)
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  return withTime ? `${base} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` : base
}
const WD_STATUS: Record<string, string> = { pending: 'Menunggu', approved: 'Diluluskan', paid: 'Dibayar', rejected: 'Ditolak' }
const ATTR_STATUS: Record<string, string> = { pending: 'Menunggu', credited: 'Dikreditkan', reversed: 'Dibatalkan' }
const REASON: Record<string, string> = {
  refunded: 'refund', cancelled: 'batal', order_cancelled: 'order batal', order_not_delivered: 'tidak dihantar', affiliate_inactive: 'affiliate tidak aktif',
}

type Tab = 'affiliate' | 'permohonan' | 'komisen' | 'pengeluaran' | 'tetapan'

export function AffiliatesClient({ data }: { data: AdminAffData }) {
  const { profiles, withdrawals, applications, attributions, clicks30ByAff, settings } = data
  const [tab, setTab] = useState<Tab>('affiliate')
  const [loading, setLoading] = useState<string | null>(null)
  const [expandedWd, setExpandedWd] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [commissionSearch, setCommissionSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'credited' | 'reversed'>('all')
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({})
  const [cfg, setCfg] = useState({
    holdDays: String(settings.holdDays), windowDays: String(settings.windowDays),
    minWithdraw: String(settings.minWithdraw), notifyWa: settings.notifyWa,
  })
  const [savingCfg, setSavingCfg] = useState(false)

  const affiliates    = useMemo(() => profiles.filter(p => p.is_affiliate), [profiles])
  const nonAffiliates = useMemo(() => profiles.filter(p => !p.is_affiliate), [profiles])
  const pendingWds    = useMemo(() => withdrawals.filter(w => w.status === 'pending' || w.status === 'approved'), [withdrawals])
  const paidTotal     = useMemo(() => withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0), [withdrawals])
  const pendingTotal  = useMemo(() => attributions.filter(a => a.status === 'pending').reduce((s, a) => s + a.amount, 0), [attributions])
  const creditedTotal = useMemo(() => attributions.filter(a => a.status === 'credited').reduce((s, a) => s + a.amount, 0), [attributions])

  // Ringkasan setiap affiliate
  const perAff = useMemo(() => {
    const m: Record<string, { orders: Set<string>; credited: number; pending: number }> = {}
    for (const a of attributions) {
      const e = (m[a.affiliateId] ??= { orders: new Set(), credited: 0, pending: 0 })
      if (a.status !== 'reversed') e.orders.add(`${a.source}:${a.orderId}`)
      if (a.status === 'credited') e.credited += a.amount
      if (a.status === 'pending') e.pending += a.amount
    }
    return m
  }, [attributions])

  const filteredNonAffiliates = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return nonAffiliates.slice(0, 50)
    return nonAffiliates.filter(p =>
      (p.full_name ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || (p.phone ?? '').includes(q)).slice(0, 50)
  }, [nonAffiliates, customerSearch])

  const filteredCommissions = useMemo(() => {
    const q = commissionSearch.trim().toLowerCase()
    return attributions.filter(a =>
      (statusFilter === 'all' || a.status === statusFilter) &&
      (!q || (a.affiliateName ?? '').toLowerCase().includes(q) || (a.affiliateEmail ?? '').toLowerCase().includes(q)
        || (a.orderNumber ?? '').toLowerCase().includes(q) || a.productName.toLowerCase().includes(q)))
  }, [attributions, commissionSearch, statusFilter])

  function exportCsv() {
    const rows = [
      ['Tarikh', 'Affiliate', 'Email', 'Pesanan', 'Sumber', 'Produk', 'Jualan bersih (RM)', 'Kadar (%)', 'Komisen (RM)', 'Status', 'Kredit selepas'],
      ...filteredCommissions.map(a => [
        dt(a.createdAt), a.affiliateName ?? '', a.affiliateEmail ?? '', a.orderNumber ?? a.orderId,
        a.lpSlug ? `LP ${a.lpSlug}` : a.source === 'lp_guest' ? 'Tetamu' : 'Kedai',
        a.productName, a.net.toFixed(2), (a.rate * 100).toFixed(1), a.amount.toFixed(2), ATTR_STATUS[a.status], dt(a.creditAfter),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `komisen-affiliate-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function generateInvite() {
    setGeneratingInvite(true)
    const res = await fetch('/api/admin/affiliates/invite', { method: 'POST' })
    const j = await res.json().catch(() => ({}))
    setGeneratingInvite(false)
    if (!res.ok) { toast.error(j.error ?? 'Gagal jana pautan'); return }
    setInviteLink(j.link)
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteLink); setInviteCopied(true); toast.success('Pautan disalin'); setTimeout(() => setInviteCopied(false), 1500) }
    catch { toast.error('Gagal salin') }
  }
  async function toggleAffiliate(id: string, current: boolean) {
    const name = profiles.find(p => p.id === id)?.full_name ?? 'pengguna ini'
    if (!window.confirm(current ? `Buang ${name} daripada program affiliate? Komisen menunggu akan dibatalkan oleh cron.` : `Jadikan ${name} affiliate?`)) return
    setLoading(id)
    const res = await fetch(`/api/admin/affiliates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_affiliate: !current }) })
    const j = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok) { toast.error(j.error ?? 'Gagal'); return }
    toast.success(current ? 'Dialih keluar' : 'Dijadikan affiliate'); location.reload()
  }
  async function updateWithdrawal(id: string, status: 'approved' | 'rejected' | 'paid') {
    if (status === 'paid' && !window.confirm('Sahkan bayaran sudah dibuat ke akaun bank affiliate?')) return
    setLoading(id)
    const res = await fetch(`/api/admin/affiliates/withdrawals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, admin_note: adminNote || undefined }) })
    const j = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok) { toast.error(j.error ?? 'Gagal'); return }
    toast.success(`Status: ${WD_STATUS[status]}`); location.reload()
  }
  async function decideApplication(id: string, action: 'approve' | 'reject') {
    const name = applications.find(a => a.id === id)?.applicant?.full_name ?? 'pemohon ini'
    if (action === 'approve' && !window.confirm(`Luluskan permohonan ${name}?`)) return
    setLoading(id)
    const res = await fetch(`/api/admin/affiliates/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, admin_note: rejectNote[id] || undefined }) })
    const j = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok) { toast.error(j.error ?? 'Gagal'); return }
    toast.success(action === 'approve' ? 'Diluluskan' : 'Ditolak'); location.reload()
  }
  async function saveSettings() {
    const hold = parseInt(cfg.holdDays, 10), win = parseInt(cfg.windowDays, 10), min = parseFloat(cfg.minWithdraw)
    if (!Number.isFinite(hold) || hold < 0 || hold > 60) { toast.error('Tempoh tahan 0–60 hari'); return }
    if (!Number.isFinite(win) || win < 1 || win > 365) { toast.error('Tetingkap 1–365 hari'); return }
    if (!Number.isFinite(min) || min < 1 || min > 10000) { toast.error('Minimum pengeluaran 1–10000'); return }
    setSavingCfg(true)
    const pairs: [string, string][] = [
      ['affiliate_hold_days', String(hold)], ['affiliate_window_days', String(win)],
      ['affiliate_min_withdraw', String(min)], ['affiliate_notify_wa', cfg.notifyWa ? 'on' : 'off'],
    ]
    let ok = true
    for (const [key, value] of pairs) {
      const r = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
      if (!r.ok) ok = false
    }
    setSavingCfg(false)
    if (ok) toast.success('Tetapan disimpan'); else toast.error('Sebahagian tetapan gagal disimpan')
  }

  const tabs: { k: Tab; label: string; n?: number }[] = [
    { k: 'affiliate',   label: 'Affiliate',   n: affiliates.length },
    { k: 'permohonan',  label: 'Permohonan',  n: applications.length || undefined },
    { k: 'komisen',     label: 'Komisen',     n: attributions.length || undefined },
    { k: 'pengeluaran', label: 'Pengeluaran', n: pendingWds.length || undefined },
    { k: 'tetapan',     label: 'Tetapan' },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Program Affiliate</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kadar ikut produk · komisen tertahan {settings.holdDays} hari selepas dihantar &amp; dibayar · tetingkap klik {settings.windowDays} hari</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Stat icon={Users}            label="Affiliate aktif"      value={String(affiliates.length)} />
        <Stat icon={UserPlus}         label="Permohonan baharu"    value={String(applications.length)} />
        <Stat icon={Hourglass}        label="Komisen menunggu"     value={rm(pendingTotal)} />
        <Stat icon={ShieldCheck}      label="Komisen dikreditkan"  value={rm(creditedTotal)} />
        <Stat icon={CircleDollarSign} label="Pengeluaran dibayar"  value={rm(paidTotal)} sub={pendingWds.length ? `${pendingWds.length} menunggu` : undefined} />
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg ${tab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}{t.n ? <span className="ml-1.5 text-xs text-gray-400 tabular-nums">{t.n}</span> : null}
          </button>
        ))}
      </div>

      {/* ── AFFILIATE ── */}
      {tab === 'affiliate' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-gray-900">Pautan jemputan</p>
                <p className="text-xs text-gray-500 mt-0.5">Sekali guna, sah 30 hari. Penerima log masuk dan terus jadi affiliate.</p>
              </div>
              <button onClick={generateInvite} disabled={generatingInvite}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50">
                <Link2 className="h-4 w-4" /> {generatingInvite ? 'Menjana…' : 'Jana pautan'}
              </button>
            </div>
            {inviteLink && (
              <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <span className="text-xs text-gray-700 flex-1 truncate font-mono">{inviteLink}</span>
                <button onClick={copyInvite} className="text-gray-600 hover:text-gray-900 shrink-0">{inviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Affiliate aktif</h2>
              <span className="text-xs text-gray-400 tabular-nums">{affiliates.length}</span>
            </div>
            {affiliates.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-500 text-center">Belum ada affiliate</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] text-gray-500">
                      <th className="px-5 py-2.5 text-left font-medium">Nama</th>
                      <th className="px-3 py-2.5 text-left font-medium">Kod</th>
                      <th className="px-3 py-2.5 text-right font-medium">Klik 30h</th>
                      <th className="px-3 py-2.5 text-right font-medium">Pesanan</th>
                      <th className="px-3 py-2.5 text-right font-medium">Dikreditkan</th>
                      <th className="px-3 py-2.5 text-right font-medium">Menunggu</th>
                      <th className="px-3 py-2.5 text-right font-medium">Baki</th>
                      <th className="px-5 py-2.5 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {affiliates.map(a => {
                      const s = perAff[a.id]
                      return (
                        <tr key={a.id} className="hover:bg-gray-50/60">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-gray-900">{a.full_name ?? '—'}</div>
                            <div className="text-xs text-gray-500">{a.email}{a.phone ? ` · ${a.phone}` : ''}</div>
                          </td>
                          <td className="px-3 py-3"><span className="font-mono text-xs text-gray-900 bg-gray-100 border border-gray-200 rounded-md px-1.5 py-0.5">{a.referral_code ?? '—'}</span></td>
                          <td className="px-3 py-3 text-right tabular-nums text-gray-700">{clicks30ByAff[a.id] ?? 0}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-gray-700">{s?.orders.size ?? 0}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-gray-900">{rm(s?.credited ?? 0)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-gray-500">{rm(s?.pending ?? 0)}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-900">{rm(Number(a.affiliate_balance))}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => toggleAffiliate(a.id, true)} disabled={loading === a.id}
                              className="text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-40">
                              {loading === a.id ? '…' : 'Buang'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900">Jadikan pelanggan affiliate</h2>
              <div className="ml-auto relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Cari nama, email, telefon"
                  className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 w-56" />
              </div>
            </div>
            {filteredNonAffiliates.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-500 text-center">{customerSearch ? 'Tiada padanan' : 'Tiada pelanggan'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <tbody className="divide-y divide-gray-100">
                    {filteredNonAffiliates.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-2.5">
                          <div className="font-medium text-gray-900">{p.full_name ?? '—'}</div>
                          <div className="text-xs text-gray-500">{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{p.referral_code ?? '—'}</td>
                        <td className="px-5 py-2.5 text-right">
                          <button onClick={() => toggleAffiliate(p.id, false)} disabled={loading === p.id}
                            className="text-xs font-semibold text-gray-900 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 disabled:opacity-40">
                            {loading === p.id ? '…' : 'Jadikan affiliate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!customerSearch && nonAffiliates.length > 50 && (
                  <p className="px-5 py-2.5 text-xs text-gray-500 border-t border-gray-100">Menunjukkan 50 daripada {nonAffiliates.length}. Guna carian.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PERMOHONAN ── */}
      {tab === 'permohonan' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {applications.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <UserPlus className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Tiada permohonan baharu</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {applications.map(app => (
                <div key={app.id} className="px-5 py-4 space-y-3 max-w-2xl">
                  <div>
                    <p className="font-semibold text-gray-900">{app.applicant?.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{app.applicant?.email}{app.applicant?.phone ? ` · ${app.applicant.phone}` : ''} · {dt(app.created_at, true)}</p>
                  </div>
                  {app.message && (
                    <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                      <MessageSquare className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-700 leading-relaxed">{app.message}</p>
                    </div>
                  )}
                  <input value={rejectNote[app.id] ?? ''} onChange={e => setRejectNote(n => ({ ...n, [app.id]: e.target.value }))}
                    placeholder="Nota kepada pemohon (pilihan, dihantar bila ditolak)"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                  <div className="flex gap-2">
                    <button onClick={() => decideApplication(app.id, 'approve')} disabled={loading === app.id}
                      className="flex-1 bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-50">
                      {loading === app.id ? '…' : 'Luluskan'}
                    </button>
                    <button onClick={() => decideApplication(app.id, 'reject')} disabled={loading === app.id}
                      className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-50">
                      Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── KOMISEN ── */}
      {tab === 'komisen' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {([['all', 'Semua'], ['pending', 'Menunggu'], ['credited', 'Dikreditkan'], ['reversed', 'Dibatalkan']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setStatusFilter(k)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md ${statusFilter === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{l}</button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input value={commissionSearch} onChange={e => setCommissionSearch(e.target.value)} placeholder="Affiliate, pesanan, produk"
                  className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 w-52" />
              </div>
              <button onClick={exportCsv} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            </div>
          </div>
          {filteredCommissions.length === 0 ? (
            <p className="px-5 py-10 text-sm text-gray-500 text-center">{attributions.length === 0 ? 'Belum ada komisen. Set kadar pada produk (Products → Komisen Affiliate) dan kongsi pautan.' : 'Tiada padanan'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] text-gray-500">
                    <th className="px-5 py-2.5 text-left font-medium">Tarikh</th>
                    <th className="px-3 py-2.5 text-left font-medium">Affiliate</th>
                    <th className="px-3 py-2.5 text-left font-medium">Pesanan</th>
                    <th className="px-3 py-2.5 text-left font-medium">Produk</th>
                    <th className="px-3 py-2.5 text-right font-medium">Jualan bersih</th>
                    <th className="px-3 py-2.5 text-right font-medium">Kadar</th>
                    <th className="px-3 py-2.5 text-right font-medium">Komisen</th>
                    <th className="px-5 py-2.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCommissions.slice(0, 300).map(a => (
                    <tr key={a.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-2.5 text-gray-600 whitespace-nowrap">{dt(a.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <div className="text-gray-900">{a.affiliateName ?? '—'}</div>
                        <div className="text-[11px] text-gray-500">{a.affiliateEmail}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-mono text-xs text-gray-900">{a.orderNumber ?? a.orderId.slice(0, 8)}</div>
                        <div className="text-[11px] text-gray-500">{a.lpSlug ? `LP ${a.lpSlug}` : a.source === 'lp_guest' ? 'Tetamu' : 'Kedai'}{a.clickedAt ? ` · klik ${dt(a.clickedAt)}` : ''}</div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{a.productName}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{rm(a.net)}{a.gross > a.net ? <span className="block text-[11px] text-gray-400 line-through">{rm(a.gross)}</span> : null}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{(a.rate * 100).toFixed(1)}%</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${a.status === 'reversed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{rm(a.amount)}</td>
                      <td className="px-5 py-2.5">
                        <div className={`text-xs font-semibold ${a.status === 'credited' ? 'text-gray-900' : a.status === 'reversed' ? 'text-gray-400' : 'text-gray-600'}`}>{ATTR_STATUS[a.status]}</div>
                        <div className="text-[11px] text-gray-500">
                          {a.status === 'credited' ? dt(a.creditedAt)
                            : a.status === 'reversed' ? (REASON[a.reversedReason ?? ''] ?? a.reversedReason ?? '')
                            : a.creditAfter ? `kredit ${dt(a.creditAfter)}` : 'belum dihantar'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCommissions.length > 300 && <p className="px-5 py-2.5 text-xs text-gray-500 border-t border-gray-100">Menunjukkan 300 daripada {filteredCommissions.length}. Eksport CSV untuk senarai penuh.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── PENGELUARAN ── */}
      {tab === 'pengeluaran' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {withdrawals.length === 0 ? (
            <p className="px-5 py-12 text-sm text-gray-500 text-center">Tiada permintaan pengeluaran</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {withdrawals.map(w => {
                const open = expandedWd === w.id
                const actionable = w.status === 'pending' || w.status === 'approved'
                return (
                  <div key={w.id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{w.affiliate?.full_name ?? '—'}</span>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${w.status === 'paid' ? 'border-gray-900 text-gray-900' : w.status === 'rejected' ? 'border-gray-200 text-gray-400' : 'border-gray-300 text-gray-700'}`}>{WD_STATUS[w.status] ?? w.status}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{w.affiliate?.email}{w.affiliate?.phone ? ` · ${w.affiliate.phone}` : ''}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold tabular-nums text-gray-900">{rm(Number(w.amount))}</div>
                        <div className="text-[11px] text-gray-500">{dt(w.requested_at)}{w.processed_at ? ` → ${dt(w.processed_at)}` : ''}</div>
                      </div>
                      <button onClick={() => { setExpandedWd(open ? null : w.id); setAdminNote('') }} className="text-gray-400 hover:text-gray-700">
                        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                    {open && (
                      <div className="mt-3 space-y-3 max-w-xl">
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm space-y-1">
                          <div className="flex justify-between gap-3"><span className="text-gray-500">Bank</span><span className="font-medium text-gray-900">{w.bank_name}</span></div>
                          <div className="flex justify-between gap-3"><span className="text-gray-500">No. akaun</span><span className="font-mono font-medium text-gray-900 select-all">{w.bank_account}</span></div>
                          <div className="flex justify-between gap-3"><span className="text-gray-500">Nama akaun</span><span className="font-medium text-gray-900">{w.account_name}</span></div>
                        </div>
                        {w.admin_note && <p className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2">{w.admin_note}</p>}
                        {actionable && (
                          <div className="space-y-2">
                            <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2} placeholder="Nota admin (pilihan; rujukan pindahan, sebab tolak)"
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
                            <div className="flex gap-2 flex-wrap">
                              {w.status === 'pending' && (
                                <button onClick={() => updateWithdrawal(w.id, 'approved')} disabled={loading === w.id}
                                  className="px-3.5 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50">Luluskan</button>
                              )}
                              <button onClick={() => updateWithdrawal(w.id, 'paid')} disabled={loading === w.id}
                                className="px-3.5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50">{loading === w.id ? '…' : 'Tandakan dibayar'}</button>
                              <button onClick={() => updateWithdrawal(w.id, 'rejected')} disabled={loading === w.id}
                                className="px-3.5 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50">Tolak (pulang baki)</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TETAPAN ── */}
      {tab === 'tetapan' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 max-w-xl space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Tetapan program</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Cfg label="Tempoh tahan (hari)" hint="Selepas dihantar & dibayar">
              <input type="number" min={0} max={60} value={cfg.holdDays} onChange={e => setCfg(c => ({ ...c, holdDays: e.target.value }))} className={inputCls} />
            </Cfg>
            <Cfg label="Tetingkap klik (hari)" hint="Beli dalam tempoh ini dikira">
              <input type="number" min={1} max={365} value={cfg.windowDays} onChange={e => setCfg(c => ({ ...c, windowDays: e.target.value }))} className={inputCls} />
            </Cfg>
            <Cfg label="Minimum pengeluaran (RM)" hint="Baki minimum untuk mohon">
              <input type="number" min={1} step="1" value={cfg.minWithdraw} onChange={e => setCfg(c => ({ ...c, minWithdraw: e.target.value }))} className={inputCls} />
            </Cfg>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={cfg.notifyWa} onChange={e => setCfg(c => ({ ...c, notifyWa: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-gray-900" />
            <span>
              <span className="block text-sm font-medium text-gray-900">WhatsApp kepada affiliate</span>
              <span className="block text-xs text-gray-500">Bila komisen dikreditkan dan bila pengeluaran dibayar/ditolak. Lalai mati (dasar WA: hantar minimum).</span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            <button onClick={saveSettings} disabled={savingCfg} className="px-3.5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50">
              {savingCfg ? 'Menyimpan…' : 'Simpan'}
            </button>
            <p className="text-xs text-gray-500">Kadar komisen diset pada setiap produk: Products → Komisen Affiliate (%).</p>
          </div>
          <div className="border-t border-gray-100 pt-4 text-xs text-gray-500 space-y-1">
            <p className="flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5" /> Klik direkod di pelayan bila pelanggan buka pautan ?aff=KOD (produk, halaman promo, atau kedai).</p>
            <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Cron setiap jam kredit komisen yang cukup tempoh tahan, selepas semak semula order tidak refund/batal.</p>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-300'

function Cfg({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xl font-bold tabular-nums text-gray-900">{value}</span>
      {sub && <span className="block text-[11px] text-gray-500">{sub}</span>}
    </div>
  )
}
