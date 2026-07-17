'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { User, Phone, Send, CheckCircle } from 'lucide-react'
import { HoneypotField } from '@/components/honeypot-field'

export function LpLeadForm({ slug, thankYouTitle, thankYouMessage, thankYouWaLink, thankYouRedirect }: {
  slug: string
  thankYouTitle?: string
  thankYouMessage?: string
  thankYouWaLink?: string
  thankYouRedirect?: string
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('')
  const [website, setWebsite] = useState('') // honeypot anti-bot
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const src = [params.get('utm_source'), params.get('utm_campaign')].filter(Boolean).join('/')
    if (src) setSource(src)

    if (sessionStorage.getItem(`lp_lead_${slug}`)) setDone(true)
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() && !phone.trim()) { toast.error('Sila isi nama atau nombor telefon'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/lp/${slug}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), source, website }),
      })
      if (!res.ok) { toast.error('Gagal hantar. Cuba semula.'); return }

      sessionStorage.setItem(`lp_lead_${slug}`, '1')

      // Fire browser-side Lead event (dedup dengan CAPI via eventID)
      if (typeof window !== 'undefined' && (window as any).fbq) {
        ;(window as any).fbq('track', 'Lead')
      }

      if (thankYouRedirect) {
        window.location.href = thankYouRedirect
        return
      }

      setDone(true)
      toast.success('Terima kasih! Kami akan hubungi anda.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="my-6 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
        <p className="font-bold text-green-800 text-lg">{thankYouTitle ?? 'Terima kasih!'}</p>
        <p className="text-sm text-green-700 mt-1">{thankYouMessage ?? 'Team kami akan hubungi anda tidak lama lagi.'}</p>
        {thankYouWaLink && (
          <a
            href={thankYouWaLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 px-5 py-3 bg-[#25d366] text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(37,211,102,0.4)] hover:bg-[#1ebe5b] transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Sertai Community WhatsApp
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="my-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <p className="font-bold text-gray-900 text-base mb-4">Tinggalkan maklumat anda</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <HoneypotField value={website} onChange={setWebsite} />
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nama anda"
            className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="No. telefon (cth: 0123456789)"
            className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-[0_4px_16px_rgba(34,197,94,0.35)]"
        >
          <Send className="h-4 w-4" />
          {loading ? 'Menghantar...' : 'Hubungi Saya'}
        </button>
      </form>
    </div>
  )
}
