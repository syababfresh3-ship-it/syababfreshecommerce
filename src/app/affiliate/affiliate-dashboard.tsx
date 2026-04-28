'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Wallet, TrendingUp, Clock, CheckCircle2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

const BANKS = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong Bank', 'AmBank', 'Bank Islam', 'Bank Rakyat', 'BSN', 'Affin Bank', 'Alliance Bank', 'OCBC', 'Standard Chartered', 'HSBC']

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Menunggu semakan', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  approved: { label: 'Diluluskan',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:     { label: 'Sudah dibayar',    cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Ditolak',          cls: 'bg-red-50 text-red-700 border-red-200' },
}

export function AffiliateDashboard({ profile, commissions, withdrawals }: {
  profile: { full_name: string | null; affiliate_balance: number; referral_code: string | null }
  commissions: any[]
  withdrawals: any[]
}) {
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [form, setForm] = useState({ amount: '', bank_name: '', bank_account: '', account_name: '' })
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedWd, setExpandedWd] = useState<string | null>(null)

  const balance     = Number(profile.affiliate_balance ?? 0)
  const totalEarned = commissions.reduce((s, c) => s + Number(c.amount), 0)
  const totalWithdrawn = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0)
  const hasPending  = withdrawals.some(w => w.status === 'pending')
  const refLink     = profile.referral_code ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/daftar?ref=${profile.referral_code}` : ''

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopied(true)
      toast.success('Link disalin!')
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Gagal salin') }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt < 10) { toast.error('Minimum pengeluaran RM10'); return }
    if (amt > balance) { toast.error('Melebihi baki semasa'); return }

    setLoading(true)
    const res = await fetch('/api/affiliate/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: amt }),
    })
    const text = await res.text()
    let data: any = {}
    try { data = JSON.parse(text) } catch {}
    setLoading(false)

    if (!res.ok) { toast.error(data.error ?? 'Gagal hantar permintaan'); return }
    toast.success('Permintaan pengeluaran dihantar!')
    setShowWithdraw(false)
    setForm({ amount: '', bank_name: '', bank_account: '', account_name: '' })
    location.reload()
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-28">

      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 px-5 pt-5 pb-12 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-14 -right-14 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-black/15 blur-2xl" />
        <div className="relative">
          <p className="text-white/70 text-[11px] font-semibold tracking-widest uppercase mb-1">Baki Komisyen Anda</p>
          <p className="text-[58px] font-black text-white leading-none drop-shadow-lg">
            RM{balance.toFixed(2)}
          </p>
          <p className="text-white/60 text-sm mt-2">
            Boleh dikeluarkan (min. <span className="text-white font-bold">RM10</span>)
          </p>
          {balance >= 10 && !hasPending && (
            <button
              onClick={() => setShowWithdraw(true)}
              className="mt-4 flex items-center gap-2 bg-white text-purple-700 font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg active:scale-[0.97] transition-all"
            >
              <Wallet className="h-4 w-4" />
              Keluarkan Duit
            </button>
          )}
          {hasPending && (
            <p className="mt-3 text-yellow-300 text-xs font-semibold">⏳ Ada permintaan pengeluaran sedang diproses</p>
          )}
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <TrendingUp className="h-4 w-4 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">RM{totalEarned.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Jumlah Diperoleh</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">RM{totalWithdrawn.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Sudah Dikeluarkan</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <Clock className="h-4 w-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-900">{commissions.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Jumlah Order</p>
          </div>
        </div>

        {/* Referral link */}
        {profile.referral_code && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Link Rujukan Anda</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600 flex-1 truncate font-mono">{refLink}</span>
              <button onClick={handleCopy} className="text-purple-600 hover:text-purple-800 transition-colors shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Setiap order dari link ini akan kira komisyen untuk anda</p>
          </div>
        )}

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-bold text-gray-900 mb-4">Permintaan Pengeluaran</h2>
            <form onSubmit={handleWithdraw} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amaun (RM)</label>
                <input
                  type="number" min="10" step="0.01" required
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder={`Max RM${balance.toFixed(2)}`}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Bank</label>
                <select
                  required value={form.bank_name}
                  onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                  suppressHydrationWarning
                >
                  <option value="">Pilih bank...</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">No. Akaun</label>
                <input
                  required value={form.bank_account}
                  onChange={e => setForm(p => ({ ...p, bank_account: e.target.value }))}
                  placeholder="cth: 1234567890"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nama Pemilik Akaun</label>
                <input
                  required value={form.account_name}
                  onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))}
                  placeholder="Nama penuh seperti dalam buku bank"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-purple-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {loading ? 'Menghantar...' : 'Hantar Permintaan'}
                </button>
                <button type="button" onClick={() => setShowWithdraw(false)}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Commission history */}
        {commissions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Sejarah Komisyen</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {commissions.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-purple-50">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">Order RM{Number(c.order_total).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(c.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{(c.rate * 100).toFixed(1)}% komisyen
                    </p>
                  </div>
                  <span className="text-sm font-black shrink-0 text-purple-600">
                    +RM{Number(c.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Withdrawal history */}
        {withdrawals.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Sejarah Pengeluaran</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {withdrawals.map(w => {
                const cfg = WD_STATUS[w.status] ?? WD_STATUS.pending
                const expanded = expandedWd === w.id
                return (
                  <div key={w.id}>
                    <button
                      onClick={() => setExpandedWd(expanded ? null : w.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">RM{Number(w.amount).toFixed(2)}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${cfg.cls}`}>{cfg.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(w.requested_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 text-xs text-gray-600 space-y-1 bg-gray-50/60">
                        <p><span className="text-gray-400">Bank:</span> {w.bank_name}</p>
                        <p><span className="text-gray-400">No. Akaun:</span> <span className="font-mono">{w.bank_account}</span></p>
                        <p><span className="text-gray-400">Nama:</span> {w.account_name}</p>
                        {w.admin_note && <p className="text-yellow-700 bg-yellow-50 rounded-lg px-2 py-1.5 mt-1">{w.admin_note}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
