import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { robots: { index: false, follow: false } }
import { StoreLayout } from '@/components/layout/store-layout'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProfileSection } from './profile-section'
import { LogoutButton } from './logout-button'
import { AddressList } from './addresses'
import { PushSubscribeButton } from '@/components/store/push-subscribe'
import {
  ShoppingBag, Heart, ChevronRight, Star, Zap, Bell, Gift, DollarSign,
} from 'lucide-react'

// ── data fetching — unchanged ──────────────────────────────────────────────

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*, loyalty_tiers(name, multiplier)')
    .eq('id', user.id)
    .single()

  // Trigger may have failed at signup — ensure profile row exists
  if (!data) {
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: user.user_metadata?.full_name ?? null,
      phone: user.user_metadata?.phone ?? null,
    })
    const { data: retry } = await supabase
      .from('profiles')
      .select('*, loyalty_tiers(name, multiplier)')
      .eq('id', user.id)
      .single()
    return retry
  }

  return data
}

async function getAddresses(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function ProfilePage() {
  const profile = await getProfile()

  if (!profile) redirect('/login?redirect=/profile')

  const addresses = await getAddresses(profile.id)

  const tierName    = (profile as any).loyalty_tiers?.name ?? 'Hijau'
  const isAffiliate = (profile as any).is_affiliate === true
  const refCode     = (profile as any).referral_code as string | null

  // account page v3 conversion polish: loyalty progress toward 500pt milestone
  const loyaltyProgress    = Math.min(100, Math.round((profile.total_points / 500) * 100))
  const loyaltyPointsLeft  = Math.max(0, 500 - profile.total_points)
  const loyaltyGoalReached = profile.total_points >= 500

  return (
    <StoreLayout>
      <div className="bg-[#f5f6f5] min-h-screen">

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-fresh-400 via-brand-fresh-500 to-brand-fresh-700 px-5 pt-6 pb-14">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-14 -right-14 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-black/12 blur-2xl" />
            <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white/10 to-transparent" />
            <div className="absolute top-4   left-6    w-1.5 h-1.5 rounded-full bg-white/25" />
            <div className="absolute top-3   left-[55%] w-1  h-1   rounded-full bg-white/30" />
            <div className="absolute bottom-8 left-9   w-2   h-2   rounded-full bg-white/10" />
            <div className="absolute bottom-5 right-12  w-1.5 h-1.5 rounded-full bg-white/15" />
          </div>

          <div className="relative flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-white/15 scale-[1.45] blur-lg" />
              <div className="absolute inset-0 rounded-full bg-white/10 scale-[1.2]" />
              <div className="relative w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center text-2xl font-black text-brand-fresh-500">
                {profile.full_name?.charAt(0).toUpperCase() ?? '?'}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/55 text-[10px] font-medium mb-0.5 tracking-wide">
                Selamat datang kembali 👋
              </p>
              <h1 className="text-white font-black text-lg leading-tight truncate">
                {profile.full_name ?? 'Pelanggan'}
              </h1>
              <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold text-white mt-1.5 shadow-[0_0_16px_rgba(255,255,255,0.25)]">
                ⭐ Tier {tierName}
              </span>
            </div>
          </div>
        </div>

        {/* ── CONTENT — section order: Pesanan → Grid → Stok → WhatsApp → Addr → Profile → Notif → Logout */}
        <div className="px-4 -mt-7 pb-28 space-y-[18px]">

          {/* ── 1. PESANAN SAYA — DOMINANT main entry point ───────────────── */}
          {/* account v4 conversion polish: scale-[0.96] = stronger press feel than other cards */}
          <Link
            href="/orders"
            className="relative flex items-center gap-4 overflow-hidden bg-gradient-to-r from-brand-fresh-400 to-brand-fresh-600 rounded-2xl shadow-[0_10px_32px_rgba(34,197,94,0.42)] px-4 py-5 active:scale-[0.96] active:shadow-[0_2px_8px_rgba(34,197,94,0.20)] transition-all duration-150 ring-1 ring-brand-fresh-300/30"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/12 to-transparent rounded-2xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/8 to-transparent rounded-b-2xl" />

            <div className="relative w-12 h-12 rounded-xl bg-white/25 flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div className="relative flex-1 min-w-0">
              <p className="text-base font-black text-white tracking-tight">Pesanan Saya</p>
              {/* account v4 conversion polish: "1 tap" = zero-friction framing */}
              <p className="text-[11px] text-white/65 mt-0.5">
                Track order &amp; repeat dengan 1 tap
              </p>
            </div>
            <ChevronRight className="relative h-5 w-5 text-white/45 shrink-0" />
          </Link>

          {/* ── 2. LOYALTY + WISHLIST — hierarchy: loyalty wins ───────────── */}
          <div className="grid grid-cols-2 gap-3">

            {/* account page v3 conversion polish: loyalty — motivation through progress */}
            <Link
              href="/loyalty"
              className="bg-gradient-to-br from-white via-white to-yellow-50/80 rounded-2xl shadow-[0_3px_18px_rgba(0,0,0,0.07)] p-4 flex flex-col gap-2 active:scale-[0.97] transition-all duration-150 overflow-hidden relative"
            >
              <div className="pointer-events-none absolute -top-4 -right-4 w-16 h-16 rounded-full bg-yellow-100/40 blur-xl" />

              <div className="relative w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
              </div>

              <div className="relative">
                <p className="text-xs font-semibold text-gray-500">Loyalty</p>
                <p className="tabular-nums leading-none mt-0.5">
                  <span className="text-[22px] font-black text-gray-900">
                    {profile.total_points.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-gray-400 ml-1">mata</span>
                </p>
              </div>

              {/* account v4 conversion polish: 2-line urgency text + thicker glowing bar */}
              <div className="relative space-y-1.5">
                <div className="w-full bg-yellow-100/80 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="relative bg-gradient-to-r from-yellow-400 to-amber-400 h-2.5 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all"
                    style={{ width: `${loyaltyProgress}%` }}
                  >
                    {/* account v4: subtle breathing shimmer on bar fill */}
                    <div className="absolute inset-0 rounded-full bg-white/25 animate-pulse" style={{ animationDuration: '2.5s' }} />
                  </div>
                </div>
                {loyaltyGoalReached ? (
                  <p className="text-[9px] font-bold text-brand-fresh-500">✓ Tahap dicapai!</p>
                ) : (
                  <div>
                    {/* account v4: two-line urgency — headline + specifics */}
                    <p className="text-[10px] font-black text-yellow-600 leading-tight">
                      Hampir capai ganjaran 🎁
                    </p>
                    <p className="text-[9px] text-yellow-500/80 font-medium leading-tight mt-0.5">
                      Tinggal {loyaltyPointsLeft} mata je lagi
                    </p>
                  </div>
                )}
              </div>
            </Link>

            {/* account page v3 conversion polish: wishlist softer — updated micro copy */}
            <Link
              href="/wishlist"
              className="bg-white rounded-2xl shadow-[0_3px_18px_rgba(0,0,0,0.07)] p-4 flex flex-col gap-2 active:scale-[0.97] transition-all duration-150"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <Heart className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Senarai Simpan</p>
                {/* account page v3 conversion polish: deferred-purchase micro copy */}
                <p className="text-sm font-bold text-gray-800 mt-0.5 leading-snug">
                  Simpan dulu, beli kemudian
                </p>
              </div>
              <p className="text-[10px] text-gray-300 font-semibold mt-auto pt-1">
                Lihat semua →
              </p>
            </Link>
          </div>

          {/* ── 2b. AFFILIATE DASHBOARD — hanya untuk affiliate ──────────── */}
          {isAffiliate && (
            <Link
              href="/affiliate"
              className="flex items-center gap-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl px-4 py-4 active:scale-[0.97] transition-all shadow-[0_6px_24px_rgba(124,58,237,0.35)]"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white">Dashboard Affiliate</p>
                <p className="text-[11px] text-white/65 mt-0.5">Semak komisyen & keluarkan duit</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />
            </Link>
          )}

          {/* ── 2c. JEMPUT RAKAN — referral card ─────────────────────────── */}
          {refCode && (
            <Link
              href="/rujukan"
              className="flex items-center gap-3.5 bg-white rounded-2xl shadow-[0_3px_18px_rgba(0,0,0,0.07)] px-4 py-4 active:scale-[0.97] transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <Gift className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">Jemput Rakan, Dapat Ganjaran</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Kod anda: <span className="font-mono font-black text-green-600">{refCode}</span>
                  {' · '}Rakan dapat 50 mata percuma
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
            </Link>
          )}

          {/* ── 3. STOK CEPAT HABIS — conversion driver ──────────────────── */}
          {/* account v4 conversion polish: pulsing icon glow + action CTA line */}
          <Link
            href="/orders"
            className="flex items-center gap-3.5 bg-gray-900 rounded-2xl px-4 py-4 active:scale-[0.97] transition-all duration-150 shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
          >
            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
              {/* account v4: pulsing glow ring on icon — very subtle urgency signal */}
              <div className="absolute inset-0 rounded-xl bg-brand-fresh-500/20 animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 rounded-xl bg-brand-fresh-400/10 scale-[1.3] blur-sm" />
              <Zap className="relative h-4 w-4 text-brand-fresh-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Stok cepat habis setiap hari</p>
              {/* account v4: direct action instruction — tells user exactly what to do */}
              <p className="text-[11px] text-gray-400 mt-0.5">
                Tekan &quot;Beli Semula&quot; untuk repeat cepat ⚡
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />
          </Link>

          {/* ── 4. WHATSAPP CTA ───────────────────────────────────────────── */}
          {/* account v4 conversion polish: "Disyorkan" badge + stronger button contrast */}
          {!profile.phone && (
            <div className="bg-gradient-to-r from-brand-fresh-50 to-white border border-brand-fresh-100/80 rounded-2xl px-4 pt-3 pb-4">

              {/* account v4: recommended signal — green pulse dot + label */}
              <div className="flex items-center gap-1.5 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-fresh-500 animate-pulse" style={{ animationDuration: '2s' }} />
                <span className="text-[10px] font-bold text-brand-fresh-600 uppercase tracking-wider">
                  Disyorkan
                </span>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-fresh-100 flex items-center justify-center shrink-0">
                  <span className="text-base leading-none">📱</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-fresh-800">
                    Tambah nombor WhatsApp
                  </p>
                  <p className="text-xs text-brand-fresh-700/65 mt-0.5 leading-relaxed">
                    Terima update status pesanan terus di WhatsApp anda.
                  </p>
                  {/* account v4: stronger button — bg-brand-fresh-600 + deeper shadow */}
                  <a
                    href="#profil"
                    className="inline-flex items-center gap-1 mt-2.5 text-xs font-bold text-white bg-brand-fresh-600 px-3.5 py-2 rounded-lg shadow-[0_3px_12px_rgba(34,197,94,0.40)] active:scale-95 transition-all"
                  >
                    Tambah Sekarang →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. ADDRESSES ──────────────────────────────────────────────── */}
          <AddressList addresses={addresses as any} userId={profile.id} />

          {/* ── 6. PROFILE ────────────────────────────────────────────────── */}
          <ProfileSection profile={profile as any} />

          {/* ── 7. PUSH NOTIFICATIONS ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 pt-4 pb-1">
              <div className="w-7 h-7 rounded-lg bg-brand-fresh-50 flex items-center justify-center">
                <Bell className="h-3.5 w-3.5 text-brand-fresh-500" />
              </div>
              <p className="text-sm font-bold text-gray-900">Notifikasi</p>
            </div>
            <div className="px-4 pb-4 pt-2">
              <PushSubscribeButton />
            </div>
          </div>

          {/* ── 8. LOGOUT ─────────────────────────────────────────────────── */}
          <div className="pt-1">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200/70 to-transparent mb-5" />
            <LogoutButton />
          </div>

        </div>
      </div>
    </StoreLayout>
  )
}
