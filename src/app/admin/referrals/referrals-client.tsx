'use client'

import { useState, useMemo } from 'react'
import { Users, Gift, CheckCircle2, Clock, Search } from 'lucide-react'

export function AdminReferralsClient({ referrals }: { referrals: any[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'rewarded'>('all')

  const total    = referrals.length
  const rewarded = referrals.filter(r => r.status === 'rewarded').length
  const pending  = referrals.filter(r => r.status === 'pending').length
  const totalPts = referrals.filter(r => r.status === 'rewarded').reduce((s, r) => s + (r.referee_pts ?? 0) + (r.referrer_pts ?? 0), 0)

  const filtered = useMemo(() => {
    let list = referrals
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        (r.referrer?.full_name ?? '').toLowerCase().includes(q) ||
        (r.referrer?.email ?? '').toLowerCase().includes(q) ||
        (r.referee?.full_name ?? '').toLowerCase().includes(q) ||
        (r.referee?.email ?? '').toLowerCase().includes(q) ||
        (r.referrer?.referral_code ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [referrals, search, statusFilter])

  // Monthly breakdown
  const monthlyStats = useMemo(() => {
    const map: Record<string, { total: number; rewarded: number }> = {}
    referrals.forEach(r => {
      const month = r.created_at.slice(0, 7)
      if (!map[month]) map[month] = { total: 0, rewarded: 0 }
      map[month].total++
      if (r.status === 'rewarded') map[month].rewarded++
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  }, [referrals])

  const maxMonthly = Math.max(...monthlyStats.map(([, v]) => v.total), 1)

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Program Rujukan</h1>
        <p className="text-sm text-gray-400 mt-0.5">Semua jemputan dan ganjaran</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard icon={Users}        label="Jumlah Rujukan"      value={total}                             color="text-gray-700" />
        <StatCard icon={Clock}        label="Belum Order"          value={pending}                           color="text-yellow-600" />
        <StatCard icon={CheckCircle2} label="Diberi Ganjaran"      value={rewarded}                          color="text-green-600" />
        <StatCard icon={Gift}         label="Jumlah Mata Diberikan" value={`${totalPts.toLocaleString()} mata`} color="text-purple-600" />
      </div>

      {/* Monthly breakdown */}
      {monthlyStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Rujukan Mengikut Bulan</h2>
          <div className="space-y-3">
            {monthlyStats.map(([month, { total: mTotal, rewarded: mRewarded }]) => {
              const [year, m] = month.split('-')
              const label = new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })
              const pct = (mTotal / maxMonthly) * 100
              const rewardedPct = mTotal > 0 ? (mRewarded / mTotal) * 100 : 0
              return (
                <div key={month} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-semibold text-gray-700 capitalize truncate">{label}</p>
                  </div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className="h-full bg-gray-200 rounded-full" style={{ width: `${pct}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-green-400 rounded-full" style={{ width: `${(rewardedPct / 100) * pct}%` }} />
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <span className="text-xs font-bold text-gray-800">{mTotal} rujukan</span>
                    <span className="text-xs text-green-600 ml-1">({mRewarded} ✓)</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />Daftar</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />Dah order</span>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, email, atau kod rujukan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['all', 'pending', 'rewarded'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {s === 'all' ? `Semua (${total})` : s === 'pending' ? `Belum Order (${pending})` : `Diberi (${rewarded})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Penjemput</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dijemput</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Ganjaran</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarikh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Gift className="h-10 w-10 text-gray-200" />
                    <p className="font-medium">{search || statusFilter !== 'all' ? 'Tiada hasil carian' : 'Belum ada rujukan'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r: any) => {
                const isRewarded = r.status === 'rewarded'
                return (
                  <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 leading-tight">{r.referrer?.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.referrer?.email}</div>
                      {r.referrer?.referral_code && (
                        <div className="text-[10px] font-mono text-purple-500 mt-0.5">{r.referrer.referral_code}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 leading-tight">{r.referee?.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.referee?.email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {isRewarded ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3" /> Diberi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border bg-yellow-50 text-yellow-700 border-yellow-200">
                          <Clock className="h-3 w-3" /> Belum Order
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs">
                      <div className="text-gray-500">Referee: <span className="font-bold text-gray-800">+{r.referee_pts}</span></div>
                      <div className={isRewarded ? 'text-green-600 font-bold' : 'text-gray-400'}>
                        Referrer: {isRewarded ? `+${r.referrer_pts}` : `(${r.referrer_pts})`}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-gray-400">
                      <div>{new Date(r.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      {r.rewarded_at && (
                        <div className="text-green-500 mt-0.5">
                          ✓ {new Date(r.rewarded_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-50 text-xs text-gray-400">
            Menunjukkan {filtered.length} daripada {total} rujukan
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
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
