// View Akaun untuk GUEST (tak log masuk): header + CTA log masuk/daftar + menu awam
// + baris ahli yang ajak login (bukan paksa redirect).
import Link from 'next/link'
import {
  User, Star, Ticket, Heart, Gift, Package, HelpCircle, FileText, Bell, ChevronRight, LogIn,
  type LucideIcon,
} from 'lucide-react'

function Row({ href, icon: Icon, label, hint, external }: { href: string; icon: LucideIcon; label: string; hint?: string; external?: boolean }) {
  const inner = (
    <>
      <Icon className="h-[18px] w-[18px] text-gray-500 shrink-0" strokeWidth={2} />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-gray-800">{label}</span>
        {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
      </span>
      <ChevronRight className="h-4 w-4 text-gray-300" />
    </>
  )
  return external
    ? <a href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition">{inner}</a>
    : <Link href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition">{inner}</Link>
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 px-1">{title}</p>
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">{children}</div>
    </div>
  )
}

export function GuestProfile() {
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {/* Header gradient — ajak log masuk */}
      <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#E11D2A,#A01018)' }}>
        <div className="flex items-center gap-3.5">
          <div className="h-14 w-14 rounded-full bg-white grid place-items-center shrink-0">
            <User className="h-7 w-7 text-[#E11D2A]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold leading-tight">Selamat datang 👋</h1>
            <p className="text-[12px] text-white/70">Log masuk untuk pengalaman penuh</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Link href="/login?redirect=/profile" className="flex-1 flex items-center justify-center gap-1.5 bg-white text-[#E11D2A] rounded-xl py-2.5 text-[13px] font-extrabold">
            <LogIn className="h-4 w-4" /> Log Masuk
          </Link>
          <Link href="/daftar?redirect=/profile" className="flex-1 grid place-items-center bg-white/15 border border-white/25 text-white rounded-xl py-2.5 text-[13px] font-bold">
            Daftar
          </Link>
        </div>
      </div>

      {/* Hook daftar — voucher RM5 */}
      <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#C81824,#7f0d14)' }}>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-amber-300" />
          <h2 className="text-[15px] font-extrabold">Daftar & dapat RM5! 🎁</h2>
        </div>
        <p className="text-[12px] text-white/80 mt-1">Voucher <span className="font-bold">RM5</span> untuk order pertama + kumpul Syabab Points setiap belian.</p>
        <Link href="/daftar?redirect=/vouchers" className="inline-block mt-3 bg-white text-[#A01018] rounded-xl px-4 py-2 text-[12.5px] font-extrabold">Daftar sekarang</Link>
      </div>

      {/* Menu awam */}
      <Group title="Menu">
        <Row href="/orders" icon={Package} label="Pesanan Saya" hint="Jejak pesanan tanpa log masuk" />
        <Row href="https://manage.syababfresh.my/bantuan" icon={HelpCircle} label="Bantuan & Sokongan" external />
        <Row href="/terma" icon={FileText} label="Terma & Syarat" />
      </Group>

      {/* Ahli — ajak log masuk */}
      <Group title="Ahli SyababFresh">
        <Row href="/login?redirect=/loyalty" icon={Star} label="Syabab Points & Reward" hint="Log masuk" />
        <Row href="/login?redirect=/vouchers" icon={Ticket} label="Voucher Saya" hint="Log masuk" />
        <Row href="/login?redirect=/wishlist" icon={Heart} label="Senarai Suka" hint="Log masuk" />
        <Row href="/login?redirect=/rujukan" icon={Gift} label="Jemput Kawan" hint="Log masuk" />
        <Row href="/login?redirect=/notifications" icon={Bell} label="Notifikasi" hint="Log masuk" />
      </Group>
    </div>
  )
}
