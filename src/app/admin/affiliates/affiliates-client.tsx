'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Users, Clock, CheckCircle2, DollarSign, Settings, ChevronDown, ChevronUp, Link2, Copy, Check, TrendingUp, Search, Download, UserPlus, MessageSquare } from 'lucide-react'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  is_affiliate: boolean
  affiliate_balance: number
  referral_code: string | null
  created_at: string
}

interface Withdrawal {
  id: string
  affiliate_id: string
  amount: number
  bank_name: string
  bank_account: string
  account_name: string
  status: string
  admin_note: string | null
  requested_at: string
  processed_at: string | null
  affiliate: { full_name: string | null; email: string | null } | null
}

interface Commission {
  id: string
  affiliate_id: string
  order_id: string
  order_total: number
  rate: number
  amount: number
  status: string
  created_at: string
  affiliate: { full_name: string | null; email: string | null } | null
}

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Menunggu',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  approved: { label: 'Diluluskan', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:     { label: 'Dibayar',   cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Ditolak',   cls: 'bg-red-50 text-red-700 border-red-200' },
}

export function AffiliatesClient({ profiles, withdrawals, commissionPct, commissions, applications }: {
  profiles: Profile[]
  withdrawals: Withdrawal[]
  commissionPct: number
  commissions: Commission[]
  applications: any[]
}) {
  const [tab, setTab] = useState<'affiliates' | 'permohonan' | 'komisyen' | 'withdrawals' | 'settings'>('affiliates')
  const [loading, setLoading] = useState<string | null>(null)
  const [pct, setPct] = useState((commissionPct * 100).toFixed(1))
  const [savingPct, setSavingPct] = useState(false)
  const [expandedWd, setExpandedWd] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [commissionSearch, setCommissionSearch] = useState('')
  const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null)

  const affiliates    = useMemo(() => profiles.filter(p => p.is_affiliate), [profiles])
  const nonAffiliates = useMemo(() => profiles.filter(p => !p.is_affiliate), [profiles])
  const pendingWds    = withdrawals.filter(w => w.status === 'pending')

  const totalPaid     = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0)
  const totalCommissions = commissions.reduce((s, c) => s + Number(c.amount), 0)

  const filteredNonAffiliates = useMemo(() => {
    if (!customerSearch.trim()) return nonAffiliates.slice(0, 50)
    const q = customerSearch.toLowerCase()
    return nonAffiliates.filter(p =>
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').includes(q)
    ).slice(0, 50)
  }, [nonAffiliates, customerSearch])

  const filteredCommissions = useMemo(() => {
    if (!commissionSearch.trim()) return commissions
    const q = commissionSearch.toLowerCase()
    return commissions.filter(c =>
      (c.affiliate?.full_name ?? '').toLowerCase().includes(q) ||
      (c.affiliate?.email ?? '').toLowerCase().includes(q)
    )
  }, [commissions, commissionSearch])

  const monthlyStats = useMemo(() => {
    const map: Record<string, number> = {}
    commissions.forEach(c => {
      const month = c.created_at.slice(0, 7)
      map[month] = (map[month] ?? 0) + Number(c.amount)
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  }, [commissions])

  function exportCsv() {
    const rows = [
      ['Affiliate', 'Email', 'Nilai Order (RM)', 'Kadar (%)', 'Komisyen (RM)', 'Status', 'Tarikh'],
      ...filteredCommissions.map(c => [
        c.affiliate?.full_name ?? '',
        c.affiliate?.email ?? '',
        Number(c.order_total).toFixed(2),
        (c.rate * 100).toFixed(1),
        Number(c.amount).toFixed(2),
        c.status,
        new Date(c.created_at).toLocaleDateString('ms-MY'),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `komisyen-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function generateInvite() {
    setGeneratingInvite(true)
    const res = await fetch('/api/admin/affiliates/invite', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setGeneratingInvite(false)
    if (!res.ok) { toast.error(data.error ?? 'Gagal jana link'); return }
    setInviteLink(data.link)
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setInviteCopied(true)
      toast.success('Link disalin!')
      setTimeout(() => setInviteCopied(false), 2000)
    } catch { toast.error('Gagal salin') }
  }

  async function toggleAffiliate(id: string, current: boolean) {
    const name = profiles.find(p => p.id === id)?.full_name ?? 'pengguna ini'
    const msg = current
      ? `Buang ${name} dari program affiliate?`
      : `Jadikan ${name} sebagai affiliate?`
    if (!window.confirm(msg)) return

    setLoading(id)
    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_affiliate: !current }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) toast.error(data.error ?? 'Gagal')
    else { toast.success(!current ? 'Dijadikan affiliate' : 'Dialih keluar dari affiliate'); location.reload() }
    setLoading(null)
  }

  async function updateWithdrawal(id: string, status: string) {
    setLoading(id)
    const res = await fetch(`/api/admin/affiliates/withdrawals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_note: adminNote || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) toast.error(data.error ?? 'Gagal')
    else { toast.success('Status dikemaskini'); location.reload() }
    setLoading(null)
  }

  async function saveCommissionRate() {
    const val = parseFloat(pct)
    if (isNaN(val) || val <= 0 || val > 100) { toast.error('Kadar tidak sah (0–100%)'); return }
    setSavingPct(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'affiliate_commission_pct', value: String(val / 100) }),
    })
    setSavingPct(false)
    if (res.ok) toast.success('Kadar komisyen disimpan')
    else toast.error('Gagal simpan')
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Program Affiliate</h1>
        <p className="text-sm text-gray-400 mt-0.5">Urus affiliate, komisyen, dan pengeluaran</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat icon={Users}      label="Jumlah Affiliate"  value={affiliates.length}                color="text-blue-600" />
        <Stat icon={UserPlus}   label="Permohonan Baru"   value={applications.length}              color="text-purple-600" />
        <Stat icon={Clock}      label="Withdraw Pending"  value={pendingWds.length}                color="text-yellow-600" />
        <Stat icon={DollarSign} label="Jumlah Dibayar"    value={`RM${totalPaid.toFixed(2)}`}      color="text-green-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {(['affiliates', 'permohonan', 'komisyen', 'withdrawals', 'settings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'affiliates'   ? `Affiliate (${affiliates.length})` :
             t === 'permohonan'   ? `Permohonan${applications.length ? ` (${applications.length})` : ''}` :
             t === 'komisyen'     ? `Komisyen${commissions.length ? ` (${commissions.length})` : ''}` :
             t === 'withdrawals'  ? `Pengeluaran${pendingWds.length ? ` (${pendingWds.length})` : ''}` :
             'Tetapan'}
          </button>
        ))}
      </div>

      {/* ── TAB: AFFILIATES ── */}
      {tab === 'affiliates' && (
        <div className="space-y-4">

          {/* Invite link generator */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Jana Link Jemputan</p>
                <p className="text-xs text-gray-400 mt-0.5">Link sekali guna, sah 30 hari</p>
              </div>
              <button
                onClick={generateInvite}
                disabled={generatingInvite}
                className="flex items-center gap-2 bg-purple-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors shrink-0"
              >
                <Link2 className="h-3.5 w-3.5" />
                {generatingInvite ? 'Jana...' : 'Jana Link'}
              </button>
            </div>
            {inviteLink && (
              <div className="mt-3 flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
                <span className="text-xs text-purple-700 flex-1 truncate font-mono">{inviteLink}</span>
                <button onClick={copyInvite} className="text-purple-500 hover:text-purple-700 shrink-0">
                  {inviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>

          {/* Active affiliates */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <h2 className="font-bold text-gray-900 text-sm">Affiliate Aktif</h2>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{affiliates.length}</span>
            </div>
            {affiliates.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Tiada affiliate lagi</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
                      <th className="px-5 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Kod</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Baki</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {affiliates.map(a => {
                      const isExpanded = expandedAffiliate === a.id
                      const myCommissions = commissions.filter(c => c.affiliate_id === a.id)
                      const myTotal = myCommissions.reduce((s, c) => s + Number(c.amount), 0)
                      return (
                        <>
                          <tr
                            key={a.id}
                            className="hover:bg-gray-50/60 cursor-pointer"
                            onClick={() => setExpandedAffiliate(isExpanded ? null : a.id)}
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                                <div>
                                  <div className="font-semibold text-gray-900">{a.full_name ?? '—'}</div>
                                  <div className="text-xs text-gray-400">{a.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                                {a.referral_code ?? '—'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-black text-gray-900">
                              RM{Number(a.affiliate_balance).toFixed(2)}
                            </td>
                            <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => toggleAffiliate(a.id, true)}
                                disabled={loading === a.id}
                                className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-40"
                              >
                                {loading === a.id ? '...' : 'Buang'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${a.id}-detail`} className="bg-purple-50/40">
                              <td colSpan={4} className="px-5 py-4">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-4 text-xs">
                                    <span className="text-gray-500">Jumlah komisyen: <span className="font-black text-purple-600">RM{myTotal.toFixed(2)}</span></span>
                                    <span className="text-gray-500">Transaksi: <span className="font-bold text-gray-700">{myCommissions.length}</span></span>
                                    <span className="text-gray-500">Phone: <span className="font-mono text-gray-700">{a.phone ?? '—'}</span></span>
                                  </div>
                                  {myCommissions.length > 0 && (
                                    <div className="bg-white rounded-xl border border-purple-100 overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-purple-50 border-b border-purple-100">
                                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Nilai Order</th>
                                            <th className="px-3 py-2 text-right text-gray-500 font-semibold">Kadar</th>
                                            <th className="px-3 py-2 text-right text-gray-500 font-semibold">Komisyen</th>
                                            <th className="px-3 py-2 text-right text-gray-500 font-semibold">Tarikh</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-purple-50">
                                          {myCommissions.slice(0, 10).map(c => (
                                            <tr key={c.id}>
                                              <td className="px-3 py-2 text-gray-700">RM{Number(c.order_total).toFixed(2)}</td>
                                              <td className="px-3 py-2 text-right text-gray-400">{(c.rate * 100).toFixed(1)}%</td>
                                              <td className="px-3 py-2 text-right font-bold text-purple-600">RM{Number(c.amount).toFixed(2)}</td>
                                              <td className="px-3 py-2 text-right text-gray-400">
                                                {new Date(c.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {myCommissions.length > 10 && (
                                        <p className="px-3 py-2 text-xs text-gray-400 border-t border-purple-50">
                                          +{myCommissions.length - 10} lagi — lihat tab Komisyen untuk senarai lengkap
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add affiliate from customers */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="font-bold text-gray-900 text-sm">Pelanggan</h2>
              <div className="ml-auto relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama, email..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 w-44"
                />
              </div>
            </div>
            {filteredNonAffiliates.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                {customerSearch ? 'Tiada hasil carian' : 'Tiada pelanggan lagi'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[360px]">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
                      <th className="px-5 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Kod</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredNonAffiliates.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-gray-900">{p.full_name ?? '—'}</div>
                          <div className="text-xs text-gray-400">{p.email}</div>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="font-mono text-xs text-gray-400">{p.referral_code ?? '—'}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => toggleAffiliate(p.id, false)}
                            disabled={loading === p.id}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-40"
                          >
                            {loading === p.id ? '...' : 'Jadikan Affiliate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!customerSearch && nonAffiliates.length > 50 && (
                  <p className="px-5 py-2.5 text-xs text-gray-400 border-t border-gray-50">
                    Tunjuk 50 daripada {nonAffiliates.length} — guna carian untuk cari nama spesifik
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PERMOHONAN ── */}
      {tab === 'permohonan' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {applications.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <UserPlus className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Tiada permohonan baharu</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {applications.map((app: any) => {
                const applicant = app.applicant as any
                return (
                  <div key={app.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-xs font-black text-purple-600">
                        {(applicant?.full_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{applicant?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{applicant?.email}</p>
                        {applicant?.phone && <p className="text-xs text-gray-400 font-mono">{applicant.phone}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(app.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    {app.message && (
                      <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <MessageSquare className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-gray-600 leading-relaxed">{app.message}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Luluskan permohonan ${applicant?.full_name ?? 'ini'}?`)) return
                          setLoading(app.id)
                          const res = await fetch(`/api/admin/affiliates/applications/${app.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'approve' }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok) toast.error(data.error ?? 'Gagal')
                          else { toast.success('Permohonan diluluskan, WA dihantar'); location.reload() }
                          setLoading(null)
                        }}
                        disabled={loading === app.id}
                        className="flex-1 bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {loading === app.id ? '...' : '✓ Luluskan'}
                      </button>
                      <button
                        onClick={async () => {
                          const note = window.prompt(`Nota untuk ${applicant?.full_name ?? 'pemohon'} (optional):`) ?? ''
                          if (note === null) return
                          setLoading(app.id)
                          const res = await fetch(`/api/admin/affiliates/applications/${app.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'reject', admin_note: note }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok) toast.error(data.error ?? 'Gagal')
                          else { toast.success('Permohonan ditolak'); location.reload() }
                          setLoading(null)
                        }}
                        disabled={loading === app.id}
                        className="flex-1 bg-red-50 text-red-600 text-sm font-bold py-2.5 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: KOMISYEN ── */}
      {tab === 'komisyen' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
              <p className="text-xl font-black text-purple-600">RM{totalCommissions.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Jumlah Komisyen</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
              <p className="text-xl font-black text-gray-900">{commissions.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Jumlah Transaksi</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
              <p className="text-xl font-black text-green-600">{(commissionPct * 100).toFixed(1)}%</p>
              <p className="text-xs text-gray-400 mt-0.5">Kadar Semasa</p>
            </div>
          </div>

          {/* Monthly breakdown */}
          {monthlyStats.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 text-sm">Komisyen Mengikut Bulan</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {monthlyStats.map(([month, total]) => {
                  const [year, m] = month.split('-')
                  const label = new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })
                  const pct = totalCommissions > 0 ? (total / totalCommissions) * 100 : 0
                  return (
                    <div key={month} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 capitalize">{label}</p>
                        <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-black text-purple-600 shrink-0">RM{total.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <h2 className="font-bold text-gray-900 text-sm">Semua Komisyen</h2>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari affiliate..."
                    value={commissionSearch}
                    onChange={e => setCommissionSearch(e.target.value)}
                    className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 w-40"
                  />
                </div>
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 border border-purple-200 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              </div>
            </div>
            {filteredCommissions.length === 0 ? (
              <p className="px-5 py-10 text-sm text-gray-400 text-center">
                {commissionSearch ? 'Tiada hasil carian' : 'Belum ada komisyen'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Affiliate</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Nilai Order</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Kadar</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Komisyen</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarikh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredCommissions.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50/60">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-gray-900">{c.affiliate?.full_name ?? '—'}</div>
                          <div className="text-xs text-gray-400">{c.affiliate?.email}</div>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600">RM{Number(c.order_total).toFixed(2)}</td>
                        <td className="px-5 py-3 text-right text-gray-400 text-xs">{(c.rate * 100).toFixed(1)}%</td>
                        <td className="px-5 py-3 text-right font-black text-purple-600">RM{Number(c.amount).toFixed(2)}</td>
                        <td className="px-5 py-3 text-right text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: WITHDRAWALS ── */}
      {tab === 'withdrawals' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {withdrawals.length === 0 ? (
            <p className="px-5 py-12 text-sm text-gray-400 text-center">Tiada permintaan pengeluaran</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {withdrawals.map(w => {
                const cfg = WD_STATUS[w.status] ?? WD_STATUS.pending
                const expanded = expandedWd === w.id
                return (
                  <div key={w.id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{w.affiliate?.full_name ?? '—'}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${cfg.cls}`}>{cfg.label}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{w.affiliate?.email}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-gray-900">RM{Number(w.amount).toFixed(2)}</div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(w.requested_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <button onClick={() => { setExpandedWd(expanded ? null : w.id); setAdminNote('') }} className="text-gray-400 hover:text-gray-600">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    {expanded && (
                      <div className="mt-4 space-y-3">
                        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
                          <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-semibold">{w.bank_name}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">No. Akaun</span><span className="font-mono font-semibold">{w.bank_account}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Nama Akaun</span><span className="font-semibold">{w.account_name}</span></div>
                        </div>
                        {w.admin_note && (
                          <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">{w.admin_note}</p>
                        )}
                        {(w.status === 'pending' || w.status === 'approved') && (
                          <div className="space-y-2">
                            <textarea
                              placeholder="Nota admin (optional)"
                              value={adminNote}
                              onChange={e => setAdminNote(e.target.value)}
                              rows={2}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateWithdrawal(w.id, 'paid')}
                                disabled={loading === w.id}
                                className="flex-1 bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {loading === w.id ? '...' : 'Tandakan Dibayar'}
                              </button>
                              <button
                                onClick={() => updateWithdrawal(w.id, 'rejected')}
                                disabled={loading === w.id}
                                className="flex-1 bg-red-50 text-red-600 text-sm font-bold py-2.5 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
                              >
                                Tolak
                              </button>
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

      {/* ── TAB: SETTINGS ── */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 max-w-sm">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900 text-sm">Tetapan Komisyen</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Kadar Komisyen (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={pct}
                  onChange={e => setPct(e.target.value)}
                  className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 font-mono"
                />
                <span className="text-sm text-gray-500 font-semibold">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Contoh: order RM200 × {pct}% = RM{((parseFloat(pct) || 0) / 100 * 200).toFixed(2)} komisyen
              </p>
            </div>
            <button
              onClick={saveCommissionRate}
              disabled={savingPct}
              className="w-full bg-red-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {savingPct ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <span className={`text-xl font-black ${color}`}>{value}</span>
    </div>
  )
}
