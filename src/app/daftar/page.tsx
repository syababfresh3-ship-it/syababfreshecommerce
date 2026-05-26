'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Gift, ChevronDown } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function DaftarForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'
  const refCodeParam = searchParams.get('ref') ?? ''

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [refCode, setRefCode] = useState(refCodeParam.toUpperCase())
  const [showRefInput, setShowRefInput] = useState(false)
  const [checkingCode, setCheckingCode] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })

  // Auto-lookup referrer name when code comes from URL param
  useEffect(() => {
    if (!refCodeParam) return
    setCheckingCode(true)
    fetch(`/api/referrals/lookup?code=${refCodeParam.toUpperCase()}`)
      .then(r => r.json())
      .then(d => { if (d.name) setReferrerName(d.name) })
      .catch(() => {})
      .finally(() => setCheckingCode(false))
  }, [refCodeParam])

  // Lookup when user manually types a code
  async function handleCodeLookup(code: string) {
    const upper = code.toUpperCase()
    setRefCode(upper)
    if (upper.length < 4) { setReferrerName(null); return }
    setCheckingCode(true)
    try {
      const res = await fetch(`/api/referrals/lookup?code=${upper}`)
      const data = await res.json()
      setReferrerName(res.ok ? (data.name ?? null) : null)
    } catch {
      setReferrerName(null)
    } finally {
      setCheckingCode(false)
    }
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    const supabase = createClient()
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
    callbackUrl.searchParams.set('next', redirectTo)
    if (refCode) callbackUrl.searchParams.set('ref', refCode)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    })
    if (error) {
      toast.error('Gagal daftar dengan Google')
      setGoogleLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 6) {
      toast.error('Kata laluan sekurang-kurangnya 6 aksara')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, phone: form.phone || null },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (refCode && data.user) {
      try {
        await fetch('/api/referrals/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref_code: refCode }),
        })
      } catch {
        // silent
      }
    }

    toast.success('Akaun berjaya dibuat! Selamat datang 🎉')
    router.push(redirectTo)
    router.refresh()
  }

  const hasValidCode = refCode.length >= 4 && referrerName !== null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">SyababFresh</h1>
          <p className="text-gray-500 text-sm mt-1">Buat akaun baru</p>
        </div>

        {/* Referral banner */}
        {hasValidCode ? (
          <div className="mb-4 flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <Gift className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">
              <span className="font-black">{referrerName}</span> jemput anda — dapat{' '}
              <span className="font-black">50 mata</span> percuma selepas daftar! 🎁
            </p>
          </div>
        ) : refCodeParam && !checkingCode && !referrerName ? (
          <div className="mb-4 flex items-center gap-2.5 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <Gift className="h-4 w-4 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700">Kod rujukan tidak sah atau sudah tidak aktif.</p>
          </div>
        ) : null}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            suppressHydrationWarning
            className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Daftar dengan Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">atau isi borang</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Penuh</label>
              <input name="full_name" value={form.full_name} onChange={handleChange} required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Ahmad bin Ali" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required autoComplete="email"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="email@contoh.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">No. Telefon</label>
              <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="011-1234 5678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kata Laluan</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} required autoComplete="new-password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Min. 6 aksara" />
            </div>

            {/* Manual referral code — collapsed by default unless already has code from URL */}
            {!refCodeParam && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowRefInput(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Gift className="h-3.5 w-3.5" />
                  Ada kod rujukan?
                  <ChevronDown className={`h-3 w-3 transition-transform ${showRefInput ? 'rotate-180' : ''}`} />
                </button>
                {showRefInput && (
                  <div className="mt-2 relative">
                    <input
                      type="text"
                      value={refCode}
                      onChange={e => handleCodeLookup(e.target.value)}
                      placeholder="Masukkan kod rujukan"
                      maxLength={12}
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 uppercase tracking-widest ${
                        hasValidCode ? 'border-green-300 bg-green-50 focus:ring-green-300' :
                        refCode.length >= 4 && !checkingCode && !referrerName ? 'border-red-200 focus:ring-red-300' :
                        'border-gray-200 focus:ring-red-500'
                      }`}
                    />
                    {checkingCode && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {hasValidCode && (
                      <p className="text-xs text-green-600 font-semibold mt-1.5 flex items-center gap-1">
                        <Gift className="h-3 w-3" />
                        Dijemput oleh {referrerName} — dapat 50 mata percuma!
                      </p>
                    )}
                    {refCode.length >= 4 && !checkingCode && !referrerName && (
                      <p className="text-xs text-red-500 mt-1.5">Kod tidak dijumpai.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-red-600 text-white font-semibold py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Dah ada akaun?{' '}
            <Link href={redirectTo !== '/' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'} className="text-red-600 font-medium hover:underline">
              Log Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DaftarPage() {
  return (
    <Suspense>
      <DaftarForm />
    </Suspense>
  )
}
