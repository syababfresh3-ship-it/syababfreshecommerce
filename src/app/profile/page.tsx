import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { robots: { index: false, follow: false } }
import Link from 'next/link'
import {
  Star, Ticket, Heart, Gift, Package, MapPin, Bell, HelpCircle,
  SlidersHorizontal, FileText, ChevronRight, DollarSign, type LucideIcon,
} from 'lucide-react'
import { SfShell } from '@/components/storev2/sf-shell'
import { LogoutButton } from './logout-button'
import { GuestProfile } from './guest-profile'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*, loyalty_tiers(name, min_spend, multiplier)')
    .eq('id', user.id)
    .single()

  if (!data) {
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: user.user_metadata?.full_name ?? null,
      phone: user.user_metadata?.phone ?? null,
    })
    const { data: retry } = await supabase
      .from('profiles')
      .select('*, loyalty_tiers(name, min_spend, multiplier)')
      .eq('id', user.id)
      .single()
    return retry
  }
  return data
}

async function getStampCard(userId: string) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const [{ data: sc }, { data: st }, { data: rw }] = await Promise.all([
    admin.from('stamp_cards').select('stamps').eq('user_id', userId).maybeSingle(),
    admin.from('app_settings').select('value').eq('key', 'kad_setia_target').maybeSingle(),
    admin.from('app_settings').select('value').eq('key', 'kad_setia_reward').maybeSingle(),
  ])
  return {
    stamps: Number(sc?.stamps ?? 0),
    target: Number(st?.value ?? '9') || 9,
    reward: Number(rw?.value ?? '15.90') || 15.9,
  }
}

async function getTiers() {
  const supabase = await createClient()
  const { data } = await supabase.from('loyalty_tiers').select('name, min_spend').order('min_spend', { ascending: true })
  return data ?? []
}

function MenuRow({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition">
      <Icon className="h-[18px] w-[18px] text-gray-500 shrink-0" strokeWidth={2} />
      <span className="flex-1 text-[14px] font-semibold text-gray-800">{label}</span>
      <ChevronRight className="h-4 w-4 text-gray-300" />
    </Link>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 px-1">{title}</p>
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">{children}</div>
    </div>
  )
}

export default async function ProfilePage() {
  const profile = await getProfile()
  // Guest (tak log masuk) → view guest (CTA login/daftar + menu awam), bukan paksa login.
  if (!profile) return <SfShell><GuestProfile /></SfShell>

  const [tiers, stamp] = await Promise.all([getTiers(), getStampCard(profile.id)])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = profile as any
  const tierName = p.loyalty_tiers?.name ?? 'Hijau'
  const isAffiliate = p.is_affiliate === true
  const totalPoints = Number(p.total_points ?? 0)
  const totalSpend = Number(p.total_spend ?? 0)
  const email = p.email as string | null

  const idx = tiers.findIndex((t) => t.name === tierName)
  const nextTier = idx >= 0 ? tiers[idx + 1] ?? null : null
  const progressPct = nextTier ? Math.min(Math.round((totalSpend / Number(nextTier.min_spend)) * 100), 100) : 100
  const spendToNext = nextTier ? Math.max(Number(nextTier.min_spend) - totalSpend, 0) : 0

  return (
    <SfShell>
      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* ===== Header gradient merah ===== */}
        <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#E11D2A,#A01018)' }}>
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-full bg-white grid place-items-center text-[22px] font-extrabold text-[#E11D2A] shrink-0">
              {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] font-extrabold leading-tight truncate">{profile.full_name ?? 'Pelanggan'}</h1>
              {email && <p className="text-[12px] text-white/70 truncate">{email}</p>}
              <span className="inline-flex items-center gap-1 bg-white/20 border border-white/25 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1.5">
                <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> Ahli {tierName}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-black/15 p-3.5">
            <div className="flex items-end justify-between">
              <span className="text-[12.5px] font-semibold text-white/80">Syabab Points</span>
              <span className="text-[24px] font-extrabold leading-none">{totalPoints.toLocaleString()}</span>
            </div>
            <div className="mt-2.5 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[11px] text-white/70 mt-1.5">
              {nextTier ? `RM${spendToNext.toFixed(0)} belanja lagi ke tier ${nextTier.name}` : 'Anda di tier tertinggi 🎉'}
            </p>
          </div>
        </div>

        {/* ===== Kad Setia (live) ===== */}
        <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#E11D2A,#A01018)' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[12.5px] font-semibold text-white/80">Kad Setia</span>
              <p className="text-[11px] text-white/70 mt-0.5">Beli {stamp.target} kali, tebus mana-mana buah sehingga RM{stamp.reward.toFixed(2)}</p>
            </div>
            <span className="text-[24px] font-extrabold leading-none shrink-0">{stamp.stamps} / {stamp.target}</span>
          </div>
          <div className="grid gap-2 mt-3.5" style={{ gridTemplateColumns: `repeat(${stamp.target}, minmax(0, 1fr))` }}>
            {Array.from({ length: stamp.target }).map((_, i) => {
              const filled = i < stamp.stamps
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-full grid place-items-center text-[13px] ${filled ? 'bg-white shadow-sm' : 'border-2 border-dashed border-white/30 bg-white/5'}`}
                >
                  {filled ? '🍒' : ''}
                </div>
              )
            })}
          </div>
          <div className="mt-3 rounded-xl bg-white/10 py-2 px-3 flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-white/80">
            {stamp.stamps >= stamp.target ? (
              <Link href="/vouchers" className="flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5" /> Tahniah! Voucher RM{stamp.reward.toFixed(2)} dah sedia — tebus di sini
              </Link>
            ) : (
              <span>{stamp.target - stamp.stamps} belian lagi → tebus mana-mana buah sehingga RM{stamp.reward.toFixed(2)}!</span>
            )}
          </div>
        </div>

        {/* ===== Menu list ===== */}
        <Group title="Khas untuk anda">
          <MenuRow href="/loyalty" icon={Star} label="Syabab Points & Reward" />
          <MenuRow href="/vouchers" icon={Ticket} label="Voucher Saya" />
          <MenuRow href="/wishlist" icon={Heart} label="Senarai Suka" />
          <MenuRow href="/rujukan" icon={Gift} label="Jemput Kawan" />
          {isAffiliate && <MenuRow href="/affiliate" icon={DollarSign} label="Dashboard Affiliate" />}
        </Group>

        <Group title="Pesanan">
          <MenuRow href="/orders" icon={Package} label="Pesanan Saya" />
          <MenuRow href="/profile/addresses" icon={MapPin} label="Alamat Penghantaran" />
          <MenuRow href="/notifications" icon={Bell} label="Notifikasi" />
        </Group>

        <Group title="Bantuan & lain-lain">
          {/* Page bantuan penuh (data pos/tracking) di app ops — manage.syababfresh.my */}
          <MenuRow href="https://manage.syababfresh.my/bantuan" icon={HelpCircle} label="Bantuan & Sokongan" />

          <MenuRow href="/tetapan" icon={SlidersHorizontal} label="Tetapan" />
          <MenuRow href="/terma" icon={FileText} label="Terma & Syarat" />
        </Group>

        {/* Log keluar */}
        <div className="pt-1">
          <LogoutButton />
        </div>
      </div>
    </SfShell>
  )
}
