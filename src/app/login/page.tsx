'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Email atau kata laluan salah')
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const origin = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?type=recovery`,
    })
    if (error) {
      toast.error('Gagal hantar emel reset')
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">SyababFresh</h1>
          <p className="text-gray-500 text-sm mt-1">
            {resetMode ? 'Reset kata laluan' : 'Log masuk untuk teruskan'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {resetSent ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium text-sm mb-1">Emel dihantar!</p>
              <p className="text-gray-500 text-sm">Semak inbox anda dan klik link reset kata laluan.</p>
              <button onClick={() => { setResetMode(false); setResetSent(false) }} className="mt-4 text-sm text-brand-red-600 font-medium hover:underline">
                Kembali log masuk
              </button>
            </div>
          ) : resetMode ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="email@contoh.com"
                  suppressHydrationWarning
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                suppressHydrationWarning
                className="w-full bg-brand-red-600 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Hantar Link Reset
              </button>
              <button type="button" onClick={() => setResetMode(false)} className="w-full text-sm text-gray-500 hover:text-gray-700">
                Kembali
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="email@contoh.com"
                  suppressHydrationWarning
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Kata Laluan
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetMode(true)}
                    className="text-xs text-brand-red-600 hover:underline"
                  >
                    Lupa kata laluan?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="••••••••"
                  suppressHydrationWarning
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                suppressHydrationWarning
                className="w-full bg-red-600 text-white font-semibold py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Sedang log masuk...' : 'Log Masuk'}
              </button>
            </form>
          )}

          {!resetMode && !resetSent && (
            <p className="text-center text-sm text-gray-500 mt-4">
              Belum ada akaun?{' '}
              <Link href="/daftar" className="text-red-600 font-medium hover:underline">
                Daftar
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
