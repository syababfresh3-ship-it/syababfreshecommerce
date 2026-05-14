export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { Users, Gift, CheckCircle2, Clock } from 'lucide-react'

async function getReferrals() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('referrals')
    .select(`
      id, status, referee_pts, referrer_pts, rewarded_at, created_at,
      referrer:profiles!referrals_referrer_id_fkey(full_name, email, referral_code),
      referee:profiles!referrals_referee_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })

  return data ?? []
}

const statusCfg: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending:  { label: 'Menunggu',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Clock },
  rewarded: { label: 'Diberi',    cls: 'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle2 },
}

export default async function AdminReferralsPage() {
  const referrals = await getReferrals()

  const total    = referrals.length
  const rewarded = referrals.filter(r => r.status === 'rewarded').length
  const pending  = referrals.filter(r => r.status === 'pending').length
  const totalPts = referrals.reduce((sum, r) => {
    if (r.status !== 'rewarded') return sum
    return sum + (r.referee_pts ?? 0) + (r.referrer_pts ?? 0)
  }, 0)

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Program Rujukan</h1>
        <p className="text-sm text-gray-400 mt-0.5">Semua jemputan dan ganjaran</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users}       label="Jumlah Rujukan" value={total}    color="text-gray-700" />
        <StatCard icon={Clock}       label="Menunggu"       value={pending}  color="text-yellow-600" />
        <StatCard icon={CheckCircle2} label="Diberi Ganjaran" value={rewarded} color="text-green-600" />
        <StatCard icon={Gift}        label="Jumlah Mata Diberikan" value={`${totalPts.toLocaleString()} mata`} color="text-purple-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Penjemput</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dijemput</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Mata Referee</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Mata Referrer</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarikh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {referrals.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Gift className="h-10 w-10 text-gray-200" />
                    <p className="font-medium">Belum ada rujukan lagi</p>
                  </div>
                </td>
              </tr>
            ) : (
              referrals.map((r: any) => {
                const cfg = statusCfg[r.status] ?? statusCfg.pending
                const StatusIcon = cfg.icon
                return (
                  <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Referrer */}
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 leading-tight">{r.referrer?.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.referrer?.email ?? '—'}</div>
                      {r.referrer?.referral_code && (
                        <div className="text-[10px] font-mono text-purple-500 mt-0.5">{r.referrer.referral_code}</div>
                      )}
                    </td>
                    {/* Referee */}
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 leading-tight">{r.referee?.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.referee?.email ?? '—'}</div>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.cls}`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    {/* Referee pts */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-900">+{r.referee_pts}</span>
                    </td>
                    {/* Referrer pts */}
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-bold ${r.status === 'rewarded' ? 'text-green-600' : 'text-gray-400'}`}>
                        {r.status === 'rewarded' ? `+${r.referrer_pts}` : `(${r.referrer_pts})`}
                      </span>
                    </td>
                    {/* Date */}
                    <td className="px-5 py-3.5 text-right text-xs text-gray-400">
                      <div>{new Date(r.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      {r.rewarded_at && (
                        <div className="text-green-500 mt-0.5">
                          Diberi {new Date(r.rewarded_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: number | string
  color: string
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
