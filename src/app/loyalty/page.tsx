// loyalty emotional + conversion polish
import { createClient } from '@/lib/supabase/server'
import { StoreLayout } from '@/components/layout/store-layout'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Star, TrendingUp, ArrowUpRight, ArrowDownLeft,
  ShoppingBag, RefreshCcw, Zap, ChevronRight,
} from 'lucide-react'
import { ReferralCodeCard } from '@/app/referral/referral-card'

async function getLoyaltyData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profileRes, tiersRes, txRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('total_points, total_spend, referral_code, loyalty_tiers(name, min_spend, multiplier)')
      .eq('id', user.id)
      .single(),
    supabase
      .from('loyalty_tiers')
      .select('*')
      .order('sort_order'),
    supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    profile: profileRes.data,
    tiers: tiersRes.data ?? [],
    transactions: txRes.data ?? [],
  }
}

const tierGradient: Record<string, string> = {
  Hijau:    'from-brand-fresh-500 to-brand-fresh-700',
  Perak:    'from-gray-400 to-gray-600',
  Emas:     'from-yellow-400 to-amber-600',
  Platinum: 'from-purple-400 to-purple-700',
}

const tierAccent: Record<string, string> = {
  Hijau:    'bg-brand-fresh-50 border-brand-fresh-200/60 text-brand-fresh-700',
  Perak:    'bg-gray-50 border-gray-200 text-gray-600',
  Emas:     'bg-yellow-50 border-yellow-200/60 text-yellow-700',
  Platinum: 'bg-purple-50 border-purple-200/60 text-purple-700',
}

export default async function LoyaltyPage() {
  const data = await getLoyaltyData()
  if (!data) redirect('/login?redirect=/loyalty')

  const { profile, tiers, transactions } = data
  const totalPoints = profile?.total_points ?? 0
  const totalSpend  = Number(profile?.total_spend ?? 0)
  const currentTierName = (profile?.loyalty_tiers as any)?.name ?? 'Hijau'
  const multiplier  = (profile?.loyalty_tiers as any)?.multiplier ?? 1

  const currentTierIndex = tiers.findIndex((t) => t.name === currentTierName)
  const nextTier = tiers[currentTierIndex + 1] ?? null
  const progressToNext = nextTier
    ? Math.min((totalSpend / Number(nextTier.min_spend)) * 100, 100)
    : 100
  const remainToNext = nextTier
    ? Math.max(Number(nextTier.min_spend) - totalSpend, 0)
    : 0

  const heroGradient = tierGradient[currentTierName] ?? tierGradient.Hijau

  return (
    <StoreLayout>
      <div className="bg-gray-50 min-h-screen pb-28">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className={`relative overflow-hidden bg-gradient-to-br ${heroGradient} px-5 pt-5 pb-12`}>
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-14 -right-14 w-60 h-60 rounded-full bg-white/12 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-black/12 blur-2xl" />
            <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white/12 to-transparent" />
            {/* accent sparkle dots */}
            <div className="absolute top-5 left-[55%] w-1 h-1 rounded-full bg-white/35" />
            <div className="absolute top-12 left-8 w-1.5 h-1.5 rounded-full bg-white/20" />
            <div className="absolute bottom-10 right-10 w-1 h-1 rounded-full bg-white/25" />
          </div>

          <div className="relative">
            <div className="flex items-center gap-1.5 mb-3">
              <Star className="h-3.5 w-3.5 fill-white/70 text-white/70" />
              <span className="text-white/70 text-[11px] font-semibold tracking-widest uppercase">
                Mata Ganjaran Anda
              </span>
            </div>

            <p className="text-[60px] font-black text-white leading-none tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
              {totalPoints.toLocaleString()}
            </p>
            <p className="text-white/60 text-sm mt-1.5">
              Boleh guna untuk <span className="text-white font-bold">RM{(totalPoints / 10).toFixed(2)}</span> diskaun 🎁
            </p>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-[0_0_16px_rgba(255,255,255,0.25)]">
                ⭐ Tier {currentTierName}
              </span>
              <span className="bg-amber-400/30 border border-amber-300/35 px-3 py-1.5 rounded-full text-xs font-bold text-amber-100">
                🔥 {multiplier}x mata setiap RM1
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 -mt-6 space-y-4">

          {/* ── TIER PROGRESS ────────────────────────────────────────────────── */}
          {nextTier ? (
            <div className="bg-white rounded-2xl shadow-[0_6px_28px_rgba(0,0,0,0.12)] border border-gray-100/60 p-5">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-fresh-50 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-brand-fresh-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Naik ke Tier {nextTier.name}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${tierAccent[nextTier.name] ?? 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {nextTier.name}
                </span>
              </div>

              {/* Progress bar — thick with glow + pulse shimmer */}
              <div className="h-5 bg-gray-100 rounded-full overflow-hidden mb-2.5">
                <div
                  className="relative h-full bg-gradient-to-r from-brand-fresh-400 to-amber-400 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.55)] transition-all"
                  style={{ width: `${progressToNext}%` }}
                >
                  <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse" style={{ animationDuration: '2.5s' }} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-brand-fresh-600">
                  Lagi RM{remainToNext.toFixed(0)} untuk naik ke Tier {nextTier.name} 🚀
                </p>
                <p className="text-[10px] text-gray-400 tabular-nums">
                  {Math.round(progressToNext)}%
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.07)] p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Anda di tier tertinggi!</p>
                <p className="text-xs text-gray-500 mt-0.5">Tahniah — terus belanja untuk kekalkan status Platinum.</p>
              </div>
            </div>
          )}

          {/* ── ALL TIERS ────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="px-4 pt-4 pb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
              <h2 className="text-sm font-bold text-gray-900">Semua Tier & Faedah</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {tiers.map((tier) => {
                const isActive  = tier.name === currentTierName
                const isPast    = tiers.findIndex(t => t.name === tier.name) < currentTierIndex
                const isLocked  = !isActive && !isPast

                return (
                  <div
                    key={tier.id}
                    className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                      isActive ? 'bg-brand-fresh-50/60' : ''
                    }`}
                  >
                    {/* Tier dot */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${
                      isActive  ? 'bg-brand-fresh-500 text-white shadow-[0_2px_8px_rgba(34,197,94,0.4)]' :
                      isPast    ? 'bg-gray-200 text-gray-500' :
                                  'bg-gray-100 text-gray-400'
                    }`}>
                      {isPast || isActive ? '✓' : '○'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-bold ${isActive ? 'text-brand-fresh-700' : isLocked ? 'text-gray-400' : 'text-gray-600'}`}>
                          {tier.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold text-brand-fresh-600 bg-brand-fresh-100 px-1.5 py-0.5 rounded-full">
                            Semasa
                          </span>
                        )}
                      </div>
                      {tier.perks && (
                        <p className={`text-[11px] mt-0.5 ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                          {tier.perks}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={`text-[12px] font-black tabular-nums ${isActive ? 'text-amber-500' : 'text-gray-400'}`}>
                        {tier.multiplier}x
                      </p>
                      <p className={`text-[9px] ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>mata/RM1</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── EARN GUIDE ───────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.07)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Cara Kumpul Mata</h2>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: ShoppingBag,
                  label: 'Beli buah segar',
                  sub: `Setiap RM1 = ${multiplier} mata reward terus`,
                  color: 'bg-brand-fresh-50 text-brand-fresh-600',
                },
                {
                  icon: RefreshCcw,
                  label: 'Repeat order → cepat naik tier',
                  sub: 'Lebih kerap order, lebih cepat dapat faedah tier tinggi',
                  color: 'bg-blue-50 text-blue-500',
                },
                {
                  icon: Zap,
                  label: 'Promo mata bonus',
                  sub: 'Mata berganda pada produk pilihan kami dari masa ke masa',
                  color: 'bg-amber-50 text-amber-500',
                },
              ].map(({ icon: Icon, label, sub, color }) => (
                <div key={label} className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[13px] font-bold text-gray-800 leading-snug">{label}</p>
                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/products"
              className="mt-5 w-full flex items-center justify-center gap-2 bg-brand-fresh-500 text-white font-bold py-4 rounded-2xl text-sm shadow-[0_6px_22px_rgba(34,197,94,0.50),0_0_0_1px_rgba(34,197,94,0.12)] active:scale-[0.97] active:shadow-[0_2px_8px_rgba(34,197,94,0.28)] transition-all duration-150"
            >
              🛒 Order Sekarang, Kumpul Mata!
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* ── REFERRAL ─────────────────────────────────────────────────────── */}
          {profile?.referral_code && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="text-sm font-bold text-gray-900">Jemput Rakan, Dapat Ganjaran</span>
              </div>
              <ReferralCodeCard code={profile.referral_code} />
              <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.07)] p-4 flex gap-6">
                <div className="text-center flex-1">
                  <p className="text-2xl font-black text-brand-fresh-600">+50</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">mata untuk rakan</p>
                </div>
                <div className="w-px bg-gray-100" />
                <div className="text-center flex-1">
                  <p className="text-2xl font-black text-amber-500">+100</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">mata untuk anda</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 text-center px-2">
                Rakan dapat 50 mata terus selepas daftar. Anda dapat 100 mata bila rakan buat pesanan pertama.
              </p>
            </div>
          )}

          {/* ── TRANSACTION HISTORY ──────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Sejarah Transaksi</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="px-4 pb-8 pt-4 text-center">
                <p className="text-sm text-gray-400">Tiada transaksi lagi.</p>
                <p className="text-xs text-gray-300 mt-1">Buat pesanan pertama anda untuk mula kumpul mata!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50/80">
                {transactions.map((tx: any) => {
                  const isEarn = tx.points > 0
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isEarn ? 'bg-brand-fresh-50 shadow-[0_1px_6px_rgba(34,197,94,0.15)]' : 'bg-red-50'
                      }`}>
                        {isEarn
                          ? <ArrowUpRight className="h-4 w-4 text-brand-fresh-600" />
                          : <ArrowDownLeft className="h-4 w-4 text-red-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 line-clamp-1">
                          {tx.description ?? tx.type}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                          {new Date(tx.created_at).toLocaleDateString('ms-MY', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className={`text-[15px] font-black tabular-nums shrink-0 ${isEarn ? 'text-brand-fresh-600' : 'text-red-500'}`}>
                        {isEarn ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </StoreLayout>
  )
}
