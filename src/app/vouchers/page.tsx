import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureWelcomeVoucher } from '@/lib/welcome-voucher'
import { SfShell } from '@/components/storev2/sf-shell'
import { SfCopyButton } from '@/components/storev2/sf-copy-button'

export const metadata: Metadata = { title: 'Voucher Saya', robots: { index: false, follow: false } }

type Voucher = { id: string; code: string; type: string; value: number; min_order: number; expires_at: string | null }

async function getVouchers(): Promise<Voucher[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  // Pastikan welcome voucher wujud (idempotent) — cover yang signup sebelum hook.
  await ensureWelcomeVoucher(admin, user.id)

  const nowIso = new Date().toISOString()
  const { data } = await admin
    .from('promo_codes')
    .select('id, code, type, value, min_order, max_uses, uses_count, expires_at')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).filter((v: any) =>
    (v.max_uses == null || (v.uses_count ?? 0) < v.max_uses) &&
    (!v.expires_at || v.expires_at > nowIso),
  ) as Voucher[]
}

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : null
}

export default async function VouchersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/vouchers')

  const vouchers = await getVouchers()

  return (
    <SfShell>
      <div className="px-4 pt-4 pb-8">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/profile" className="h-9 w-9 grid place-items-center rounded-full -ml-1 text-gray-600 hover:bg-gray-100" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[18px] font-extrabold text-gray-900">Voucher Saya</h1>
        </div>

        {vouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-20 w-20 rounded-full bg-[#F4F6F5] grid place-items-center mb-5">
              <Ticket className="h-9 w-9 text-gray-300" />
            </div>
            <p className="text-[15px] font-extrabold text-gray-900 mb-1">Tiada voucher buat masa ni</p>
            <p className="text-[13px] text-gray-400 leading-relaxed max-w-xs">Belian & promosi akan datang dengan voucher baru. Pantau ruang ni!</p>
            <Link href="/products" className="mt-7 bg-[#E11D2A] text-white px-6 py-3 rounded-xl text-[13px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)]">
              Beli-belah
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map((v) => {
              const valLabel = v.type === 'percentage' ? `${Number(v.value)}%` : `RM${Number(v.value).toFixed(0)}`
              return (
                <div key={v.id} className="rounded-2xl overflow-hidden border border-[#E11D2A]/30 flex">
                  {/* Stub nilai */}
                  <div className="bg-[#E11D2A] text-white px-4 py-4 grid place-items-center shrink-0 w-[92px]">
                    <div className="text-center">
                      <div className="text-[22px] font-extrabold leading-none">{valLabel}</div>
                      <div className="text-[9px] font-semibold text-white/80 mt-1">OFF</div>
                    </div>
                  </div>
                  {/* Butiran */}
                  <div className="flex-1 bg-white p-3.5 min-w-0">
                    <p className="text-[13px] font-extrabold text-gray-900">Diskaun {valLabel}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Min belian RM{Number(v.min_order).toFixed(0)}{fmtDate(v.expires_at) ? ` · sah hingga ${fmtDate(v.expires_at)}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-mono text-[13px] font-extrabold text-[#E11D2A] bg-[#FDECEC] rounded-lg px-2.5 py-1 tracking-wider">{v.code}</span>
                      <SfCopyButton text={v.code} label="Salin kod" />
                    </div>
                  </div>
                </div>
              )
            })}
            <Link href="/products" className="block text-center mt-4 bg-[#E11D2A] text-white py-3 rounded-xl text-[14px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)]">
              Guna sekarang — Beli-belah
            </Link>
            <p className="text-[11px] text-gray-400 text-center mt-1">Masukkan kod di halaman Pembayaran (Checkout).</p>
          </div>
        )}
      </div>
    </SfShell>
  )
}
