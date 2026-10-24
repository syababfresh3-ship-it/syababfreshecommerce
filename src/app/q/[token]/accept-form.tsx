'use client'

// Borang terima sebut harga (awam, /q/<token>). Nama + jawatan → POST /api/q/<token>/accept.
// Honeypot kunci JSON `website` (lihat components/honeypot-field.tsx).
import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { HoneypotField } from '@/components/honeypot-field'

export function AcceptForm({ token, quoteNumber }: { token: string; quoteNumber: string }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/q/${token}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, role, website }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Something went wrong, please try again.'); return }
      setDone(j.accepted_at ?? new Date().toISOString())
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
        <CheckCircle2 className="h-7 w-7 text-green-600 mx-auto" />
        <p className="font-bold text-gray-900 mt-2">Quotation {quoteNumber} accepted</p>
        <p className="text-sm text-gray-600 mt-1">Thank you. Our team will be in touch shortly to confirm the next steps and payment.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="font-bold text-gray-900">Accept this quotation</p>
      <p className="text-sm text-gray-500 mt-1">Enter your name to confirm acceptance on behalf of your organisation.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <label className="text-sm">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Full name *</span>
          <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} autoComplete="name" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Position (optional)</span>
          <input value={role} onChange={e => setRole(e.target.value)} maxLength={120} autoComplete="organization-title" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </label>
      </div>
      <HoneypotField value={website} onChange={setWebsite} />
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      <button type="submit" disabled={busy || name.trim().length < 2} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-gray-900 text-white font-bold py-3 rounded-xl text-sm hover:bg-gray-800 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Accept quotation
      </button>
      <p className="text-[11px] text-gray-400 mt-2 text-center">By accepting, you confirm the items, prices and terms stated above.</p>
    </form>
  )
}
