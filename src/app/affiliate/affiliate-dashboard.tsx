'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Wallet, TrendingUp, Clock, CheckCircle2, Copy, Check, ChevronDown, ChevronUp, Users, Info, Share2, ArrowUp, ArrowDown, Minus } from 'lucide-react'

const BANKS = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong Bank', 'AmBank', 'Bank Islam', 'Bank Rakyat', 'BSN', 'Affin Bank', 'Alliance Bank', 'OCBC', 'Standard Chartered', 'HSBC']

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Menunggu semakan', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  approved: { label: 'Diluluskan',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:     { label: 'Sudah dibayar',    cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Ditolak',          cls: 'bg-red-50 text-red-700 border-red-200' },
}

const ORDER_STATUS: Record<string, string> = {
  confirmed: 'Disahkan', preparing: 'Sedang Disediakan', delivering: 'Dalam Penghantaran',
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function AffiliateDashboard({ profile, commissions, withdrawals, commissionRate, referrals, upcomingOrders }: {
  profile: { full_name: string | null; affiliate_balance: number; referral_code: string | null }
  commissions: any[]
  withdrawals: any[]
  commissionRate: number
  referrals: any[]
  upcomingOrders: any[]
}) {
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showHowTo, setShowHowTo] = useState(commissions.length === 0)
  const [form, setForm] = useState({ amount: '', bank_name: '', bank_account: '', account_name: '' })
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expandedWd, setExpandedWd] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'komisyen' | 'rujukan' | 'pengeluaran'>('komisyen')

  const balance        = Number(profile.affiliate_balance ?? 0)
  const totalEarned    = commissions.reduce((s, c) => s + Number(c.amount), 0)
  const totalWithdrawn = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0)
  const hasPending     = withdrawals.some(w => w.status === 'pending' || w.status === 'approved')
  const refLink        = profile.referral_code
    ? `${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my')}/daftar?ref=${profile.referral_code}`
    : ''
  const pctDisplay     = (commissionRate * 100).toFixed(1)
  const needed         = Math.max(0, 10 - balance)

  // Monthly stats
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const thisMonthEarned = commissions.filter(c => c.created_at >= thisMonthStart).reduce((s, c) => s + Number(c.amount), 0)
  const lastMonthEarned = commissions.filter(c => c.created_at >= lastMonthStart && c.created_at < thisMonthStart).reduce((s, c) => s + Number(c.amount), 0)
  const monthDiff = thisMonthEarned - lastMonthEarned

  // Upcoming commission total
  const upcomingTotal = useMemo(() => upcomingOrders.reduce((s, o) => s + o.estimatedCommission, 0), [upcomingOrders])

  // Referrals with order indicator — map referee_id to upcomingOrders
  const upcomingByReferee = useMemo(() => {
    const map: Record<string, boolean> = {}
    upcomingOrders.forEach(o => { map[o.user_id] = true })
    return map
  }, [upcomingOrders])

  const referralsOrdered = useMemo(() => referrals.filter(r => r.status === 'rewarded').length, [referrals])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopied(true)
      toast.success('Link disalin!')
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Gagal salin') }
  }

  function handleShareWa() {
    const msg = encodeURIComponent(
      `Hai! Saya nak perkenalkan SyababFresh — buah segar berkualiti dihantar ke rumah 🍒\n\nDaftar akaun guna link saya dan dapat 50 mata percuma! 🎁\n\n${refLink}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
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
    const data = await res.json().catch(() => ({}))
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
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white/70 text-[11px] font-semibold tracking-widest uppercase">Baki Komisyen</p>
            <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{pctDisplay}% setiap order</span>
          </div>
          <p className="text-[52px] font-black text-white leading-none drop-shadow-lg">
            RM{balance.toFixed(2)}
          </p>
          {upcomingTotal > 0 && (
            <p className="text-white/70 text-xs mt-1">
              + <span className="text-white font-bold">RM{upcomingTotal.toFixed(2)}</span> dijangka masuk ({upcomingOrders.length} order dalam proses)
            </p>
          )}
          {balance >= 10 && !hasPending && (
            <button onClick={() => setShowWithdraw(true)} className="mt-3 flex items-center gap-2 bg-white text-purple-700 font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg active:scale-[0.97] transition-all">
              <Wallet className="h-4 w-4" /> Keluarkan Duit
            </button>
          )}
          {balance > 0 && balance < 10 && !hasPending && (
            <p className="mt-2 text-white/70 text-xs">Terkumpul lagi <span className="text-white font-black">RM{needed.toFixed(2)}</span> untuk boleh keluarkan</p>
          )}
          {hasPending && <p className="mt-2 text-yellow-300 text-xs font-semibold">⏳ Ada permintaan pengeluaran sedang diproses</p>}
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">

        {/* Stats 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-gray-400">Jumlah Diperoleh</p>
            </div>
            <p className="text-xl font-black text-gray-900">RM{totalEarned.toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-1">
              {monthDiff > 0 ? <ArrowUp className="h-3 w-3 text-green-500" /> : monthDiff < 0 ? <ArrowDown className="h-3 w-3 text-red-400" /> : <Minus className="h-3 w-3 text-gray-300" />}
              <p className="text-[10px] text-gray-400">
                Bulan ini <span className={`font-bold ${monthDiff > 0 ? 'text-green-600' : monthDiff < 0 ? 'text-red-500' : 'text-gray-400'}`}>RM{thisMonthEarned.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-xs text-gray-400">Dikeluarkan</p>
            </div>
            <p className="text-xl font-black text-gray-900">RM{totalWithdrawn.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-400" />
              <p className="text-xs text-gray-400">Rakan Dijemput</p>
            </div>
            <p className="text-xl font-black text-gray-900">{referrals.length} orang</p>
            {referralsOrdered > 0 && <p className="text-[10px] text-green-600 mt-0.5 font-semibold">{referralsOrdered} dah buat order</p>}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-xs text-gray-400">Order Dikreditkan</p>
            </div>
            <p className="text-xl font-black text-gray-900">{commissions.length}</p>
          </div>
        </div>

        {/* Referral link + share */}
        {profile.referral_code && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Link & Kod Rujukan</p>
              <span className="font-mono text-base font-black text-purple-600 bg-purple-50 px-3 py-1 rounded-lg tracking-widest">{profile.referral_code}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-500 flex-1 truncate font-mono">{refLink}</span>
              <button onClick={handleCopy} className="text-purple-600 hover:text-purple-800 transition-colors shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleShareWa} className="flex-1 flex items-center justify-center gap-2 bg-[#25d366] text-white font-bold text-sm py-2.5 rounded-xl hover:bg-[#1ebe5b] transition-colors">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Kongsi via WhatsApp
              </button>
              <button onClick={handleCopy} className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* How it works — collapsible */}
        <div className="bg-purple-50 border border-purple-100 rounded-2xl overflow-hidden">
          <button onClick={() => setShowHowTo(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
            <Info className="h-3.5 w-3.5 text-purple-500 shrink-0" />
            <p className="text-xs font-bold text-purple-700 flex-1">Cara Jana Komisyen</p>
            {showHowTo ? <ChevronUp className="h-3.5 w-3.5 text-purple-400" /> : <ChevronDown className="h-3.5 w-3.5 text-purple-400" />}
          </button>
          {showHowTo && (
            <div className="px-4 pb-4">
              <ol className="text-xs text-purple-600 space-y-1.5 list-decimal list-inside">
                <li>Kongsi link rujukan anda kepada rakan-rakan</li>
                <li>Mereka daftar akaun guna link anda dan dapat <span className="font-black">50 mata</span> percuma</li>
                <li>Setiap kali mereka buat order dan <span className="font-black">selesai dihantar</span>, anda dapat <span className="font-black">{pctDisplay}%</span> komisyen automatik</li>
                <li>Komisyen terkumpul dalam baki — keluarkan bila dah RM10</li>
              </ol>
              <p className="text-[10px] text-purple-400 mt-2">* Komisyen dikira apabila order ditanda "Selesai Dihantar"</p>
            </div>
          )}
        </div>

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Permintaan Pengeluaran</h2>
              <p className="text-xs text-gray-400">Baki: <span className="font-black text-gray-700">RM{balance.toFixed(2)}</span></p>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amaun (RM)</label>
                <input type="number" min="10" step="0.01" max={balance} required value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder={`Min RM10 — Max RM${balance.toFixed(2)}`}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Bank</label>
                <select required value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white" suppressHydrationWarning>
                  <option value="">Pilih bank...</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">No. Akaun</label>
                <input required value={form.bank_account} onChange={e => setForm(p => ({ ...p, bank_account: e.target.value }))}
                  placeholder="cth: 1234567890"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nama Pemilik Akaun</label>
                <input required value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))}
                  placeholder="Nama penuh seperti dalam buku bank"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={loading} className="flex-1 bg-purple-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {loading ? 'Menghantar...' : 'Hantar Permintaan'}
                </button>
                <button type="button" onClick={() => setShowWithdraw(false)} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['komisyen', 'rujukan', 'pengeluaran'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {t === 'komisyen' ? `Komisyen${commissions.length ? ` (${commissions.length})` : ''}` :
               t === 'rujukan' ? `Rujukan${referrals.length ? ` (${referrals.length})` : ''}` :
               `Pengeluaran${withdrawals.length ? ` (${withdrawals.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Tab: Komisyen */}
        {activeTab === 'komisyen' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {commissions.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <TrendingUp className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-400">Belum ada komisyen lagi</p>
                <p className="text-xs text-gray-400 mt-1">Komisyen masuk apabila rakan anda membuat order yang selesai dihantar</p>
              </div>
            ) : (
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
                    <span className="text-sm font-black shrink-0 text-purple-600">+RM{Number(c.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Rujukan */}
        {activeTab === 'rujukan' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {referrals.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-400">Belum ada rujukan lagi</p>
                <p className="text-xs text-gray-400 mt-1">Kongsi link anda kepada rakan untuk mula</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {referrals.map(r => {
                  const referee = r.referee as any
                  const hasUpcoming = upcomingByReferee[referee?.id]
                  const hasOrdered = r.status === 'rewarded'
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-xs font-black text-purple-600">
                        {getInitials(referee?.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{referee?.full_name ?? 'Rakan'}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Daftar {new Date(r.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {hasUpcoming ? (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Order dalam proses</span>
                        ) : hasOrdered ? (
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">✓ Dah order</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Belum order</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Pengeluaran */}
        {activeTab === 'pengeluaran' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {withdrawals.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Wallet className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-400">Belum ada pengeluaran</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {withdrawals.map(w => {
                  const cfg = WD_STATUS[w.status] ?? WD_STATUS.pending
                  const expanded = expandedWd === w.id
                  return (
                    <div key={w.id}>
                      <button onClick={() => setExpandedWd(expanded ? null : w.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors">
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
            )}
          </div>
        )}

      </div>
    </div>
  )
}
