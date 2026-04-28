'use client'

import { useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import { toast } from 'sonner'

export function ReferralCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function getLink() {
    return `${window.location.origin}/daftar?ref=${code}`
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getLink())
      setCopied(true)
      toast.success('Link rujukan disalin!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Gagal salin')
    }
  }

  async function handleShare() {
    const link = getLink()
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SyababFresh — Buah segar terbaik',
          text: `Guna kod saya ${code} untuk daftar dan dapat 50 mata percuma! 🎁`,
          url: link,
        })
      } catch {
        // user cancelled share — no-op
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div className="bg-gradient-to-br from-brand-fresh-500 to-brand-fresh-700 rounded-2xl p-5 shadow-[0_8px_28px_rgba(34,197,94,0.38)] relative overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-black/10 blur-xl" />

      <p className="relative text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Kod Rujukan Anda</p>
      <div className="relative flex items-center gap-3 mb-4">
        <span className="text-3xl font-black text-white tracking-widest">{code}</span>
      </div>

      <div className="relative flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all text-white text-sm font-bold py-2.5 rounded-xl backdrop-blur-sm"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Disalin!' : 'Salin Link'}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all text-white text-sm font-bold px-4 py-2.5 rounded-xl backdrop-blur-sm"
        >
          <Share2 className="h-4 w-4" />
          Kongsi
        </button>
      </div>
    </div>
  )
}
