'use client'

import { useState } from 'react'
import { Copy, Check, Users, Gift, Clock, CheckCircle2, Share2 } from 'lucide-react'
import { toast } from 'sonner'

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function RujukanClient({
  profile,
  referrals,
}: {
  profile: { full_name: string | null; referral_code: string | null; total_points: number } | null
  referrals: any[]
}) {
  const [copied, setCopied] = useState(false)

  const code = profile?.referral_code ?? ''
  const refLink = typeof window !== 'undefined'
    ? `${window.location.origin}/daftar?ref=${code}`
    : `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'}/daftar?ref=${code}`

  const total    = referrals.length
  const rewarded = referrals.filter(r => r.status === 'rewarded').length
  const pending  = referrals.filter(r => r.status === 'pending').length
  const totalPtsEarned = referrals.filter(r => r.status === 'rewarded').reduce((s, r) => s + (r.referrer_pts ?? 0), 0)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopied(true)
      toast.success('Link disalin!')
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Gagal salin') }
  }

  function handleWhatsApp() {
    const name = profile?.full_name?.split(' ')[0] ?? 'saya'
    const msg = encodeURIComponent(
      `Hai! 👋\n\nSaya nak perkenalkan *SyababFresh* — buah segar berkualiti dihantar terus ke rumah! 🍒\n\nDaftar guna link ${name} dan dapat *50 mata percuma* untuk diskaun order pertama! 🎁\n\n👉 ${refLink}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-28">

      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-fresh-500 to-brand-fresh-700 px-5 pt-5 pb-12 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-14 -right-14 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-black/12 blur-2xl" />
        <div className="relative">
          <p className="text-white/70 text-[11px] font-semibold tracking-widest uppercase mb-1">Program Rujukan</p>
          <p className="text-4xl font-black text-white">{total} <span className="text-2xl font-bold text-white/70">orang dijemput</span></p>
          {totalPtsEarned > 0 && (
            <p className="text-white/70 text-sm mt-1">
              Jumlah ganjaran: <span className="text-white font-black">+{totalPtsEarned} mata</span>
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <div className="bg-white/15 rounded-xl px-4 py-2.5 text-center">
              <p className="text-xl font-black text-white">{rewarded}</p>
              <p className="text-[10px] text-white/60">Dah order</p>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-2.5 text-center">
              <p className="text-xl font-black text-white">{pending}</p>
              <p className="text-[10px] text-white/60">Belum order</p>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-2.5 text-center">
              <p className="text-xl font-black text-yellow-300">+{totalPtsEarned}</p>
              <p className="text-[10px] text-white/60">Mata diperoleh</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">

        {/* Referral card */}
        {code && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kod & Link Rujukan Anda</p>
              <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-[10px] text-gray-400">Kod</p>
                  <p className="text-xl font-black text-brand-fresh-600 tracking-widest">{code}</p>
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[10px] text-gray-400 truncate font-mono">/daftar?ref={code}</p>
                </div>
              </div>
            </div>

            {/* Reward info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-brand-fresh-50 rounded-xl px-3 py-2.5 text-center border border-brand-fresh-100">
                <p className="text-lg font-black text-brand-fresh-600">+50</p>
                <p className="text-[10px] text-brand-fresh-700">mata untuk rakan</p>
                <p className="text-[9px] text-gray-400 mt-0.5">terus selepas daftar</p>
              </div>
              <div className="bg-amber-50 rounded-xl px-3 py-2.5 text-center border border-amber-100">
                <p className="text-lg font-black text-amber-600">+100</p>
                <p className="text-[10px] text-amber-700">mata untuk anda</p>
                <p className="text-[9px] text-gray-400 mt-0.5">bila rakan buat order pertama</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 bg-[#25d366] text-white font-bold text-sm py-3 rounded-xl hover:bg-[#1ebe5b] transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Kongsi via WhatsApp
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 font-semibold text-sm px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-brand-fresh-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Disalin!' : 'Salin'}
              </button>
            </div>
          </div>
        )}

        {/* Referrals list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900 text-sm">Rakan Yang Dijemput</h2>
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{total}</span>
          </div>

          {referrals.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Gift className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">Belum ada rujukan lagi</p>
              <p className="text-xs text-gray-400 mt-1">Kongsi link anda untuk mula dapatkan ganjaran</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {referrals.map((r: any) => {
                const referee = r.referee as any
                const isRewarded = r.status === 'rewarded'
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-full bg-brand-fresh-100 flex items-center justify-center shrink-0 text-xs font-black text-brand-fresh-700">
                      {getInitials(referee?.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{referee?.full_name ?? 'Rakan'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Daftar {new Date(r.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {isRewarded ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                            <CheckCircle2 className="h-3 w-3" />
                            +{r.referrer_pts} mata
                          </span>
                          {r.rewarded_at && (
                            <p className="text-[9px] text-gray-400 mt-0.5">
                              {new Date(r.rewarded_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                          <Clock className="h-3 w-3" />
                          Belum order
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* How to earn more */}
        {pending > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
            <p className="text-sm font-bold text-amber-800">💡 {pending} rakan belum buat order lagi</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Remind mereka — anda akan dapat <span className="font-black">+100 mata</span> untuk setiap seorang yang buat order pertama.
            </p>
            <button
              onClick={handleWhatsApp}
              className="mt-3 flex items-center gap-2 bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              Kongsi Semula
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
