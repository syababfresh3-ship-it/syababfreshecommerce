'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export function ReferralCodeCard({ code, name }: { code: string; name?: string | null }) {
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

  function handleWhatsApp() {
    const firstName = name?.split(' ')[0] ?? 'saya'
    const link = getLink()
    const msg = encodeURIComponent(
      `Hai! 👋\n\nSaya nak perkenalkan *SyababFresh* — buah segar berkualiti dihantar terus ke rumah! 🍒\n\nDaftar guna link ${firstName} dan dapat *50 mata percuma* untuk diskaun order pertama! 🎁\n\n👉 ${link}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="bg-gradient-to-br from-brand-fresh-500 to-brand-fresh-700 rounded-2xl p-5 shadow-[0_8px_28px_rgba(34,197,94,0.38)] relative overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-black/10 blur-xl" />

      <div className="relative">
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Kod Rujukan Anda</p>
        <p className="text-3xl font-black text-white tracking-widest mb-1">{code}</p>
        <p className="text-white/50 text-[11px] font-mono mb-4 truncate">/daftar?ref={code}</p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-brand-fresh-700 text-sm font-bold py-2.5 rounded-xl hover:bg-white/90 active:scale-[0.97] transition-all"
          >
            <svg className="h-4 w-4 text-[#25d366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Kongsi via WhatsApp
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all text-white text-sm font-bold px-4 py-2.5 rounded-xl backdrop-blur-sm"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <Link
          href="/rujukan"
          className="flex items-center justify-center text-white/70 hover:text-white text-xs font-semibold transition-colors"
        >
          Lihat senarai rakan dijemput →
        </Link>
      </div>
    </div>
  )
}
