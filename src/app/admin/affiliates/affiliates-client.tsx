'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Users, Wallet, Clock, CheckCircle2, DollarSign, Settings, ChevronDown, ChevronUp, Link2, Copy, Check } from 'lucide-react'

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

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Menunggu',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  approved: { label: 'Diluluskan', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:     { label: 'Dibayar',   cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Ditolak',   cls: 'bg-red-50 text-red-700 border-red-200' },
}

export function AffiliatesClient({ profiles, withdrawals, commissionPct }: {
  profiles: Profile[]
  withdrawals: Withdrawal[]
  commissionPct: number
}) {
  const [tab, setTab] = useState<'affiliates' | 'withdrawals' | 'settings'>('affiliates')
  const [loading, setLoading] = useState<string | null>(null)
  const [pct, setPct] = useState((commissionPct * 100).toFixed(1))
  const [savingPct, setSavingPct] = useState(false)
  const [expandedWd, setExpandedWd] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)

  const affiliates    = useMemo(() => profiles.filter(p => p.is_affiliate), [profiles])
  const nonAffiliates = useMemo(() => profiles.filter(p => !p.is_affiliate), [profiles])
  const pendingWds    = withdrawals.filter(w => w.status === 'pending')

  const totalBalance  = affiliates.reduce((s, a) => s + Number(a.affiliate_balance), 0)
  const totalPaid     = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0)

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
    <div className="p-6 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Program Affiliate</h1>
        <p className="text-sm text-gray-400 mt-0.5">Urus affiliate, komisyen, dan pengeluaran</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat icon={Users}        label="Jumlah Affiliate"  value={affiliates.length}          color="text-blue-600" />
        <Stat icon={Clock}        label="Withdraw Pending"  value={pendingWds.length}          color="text-yellow-600" />
        <Stat icon={Wallet}       label="Baki Terkumpul"    value={`RM${totalBalance.toFixed(2)}`} color="text-purple-600" />
        <Stat icon={DollarSign}   label="Jumlah Dibayar"    value={`RM${totalPaid.toFixed(2)}`}    color="text-green-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {(['affiliates', 'withdrawals', 'settings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'affiliates' ? `Affiliate (${affiliates.length})` :
             t === 'withdrawals' ? `Pengeluaran${pendingWds.length ? ` (${pendingWds.length})` : ''}` :
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/60">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Kod</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Baki</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {affiliates.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900">{a.full_name ?? '—'}</div>
                        <div className="text-xs text-gray-400">{a.email}</div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                          {a.referral_code ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-black text-gray-900">
                        RM{Number(a.affiliate_balance).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => toggleAffiliate(a.id, true)}
                          disabled={loading === a.id}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-40"
                        >
                          Buang
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add affiliate from customers */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="font-bold text-gray-900 text-sm">Pelanggan (boleh jadikan affiliate)</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Kod</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {nonAffiliates.slice(0, 30).map(p => (
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
                        Jadikan Affiliate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                        {w.status === 'pending' && (
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
                                Tandakan Dibayar
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
                        {w.status === 'approved' && (
                          <button
                            onClick={() => updateWithdrawal(w.id, 'paid')}
                            disabled={loading === w.id}
                            className="w-full bg-green-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            Tandakan Dibayar
                          </button>
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
