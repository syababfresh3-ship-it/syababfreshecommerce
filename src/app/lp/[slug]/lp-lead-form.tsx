'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { User, Phone, Send, CheckCircle } from 'lucide-react'

export function LpLeadForm({ slug }: { slug: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('')
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
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), source }),
      })
      if (!res.ok) { toast.error('Gagal hantar. Cuba semula.'); return }

      sessionStorage.setItem(`lp_lead_${slug}`, '1')
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
        <p className="font-bold text-green-800 text-lg">Terima kasih!</p>
        <p className="text-sm text-green-700 mt-1">Team kami akan hubungi anda tidak lama lagi.</p>
      </div>
    )
  }

  return (
    <div className="my-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <p className="font-bold text-gray-900 text-base mb-4">Tinggalkan maklumat anda</p>
      <form onSubmit={handleSubmit} className="space-y-3">
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
