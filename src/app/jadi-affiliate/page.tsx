'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Gift, CheckCircle2, XCircle, Loader2, LogIn } from 'lucide-react'
import Link from 'next/link'

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, setState] = useState<'loading' | 'ready' | 'joining' | 'success' | 'error' | 'need_login'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('Token tidak dijumpai dalam link ini.'); return }
    const supabase = createClient()
    ;(supabase.auth.getUser() as Promise<any>).then((res) => {
      setUser(res.data.user)
      setState(res.data.user ? 'ready' : 'need_login')
    })
  }, [token])

  async function handleJoin() {
    setState('joining')
    const res = await fetch('/api/affiliate/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const text = await res.text()
    let data: any = {}
    try { data = JSON.parse(text) } catch {}

    if (!res.ok) {
      if (data.error === 'login_required') { setState('need_login'); return }
      setState('error')
      setErrorMsg(data.error ?? 'Ralat tidak diketahui')
      return
    }

    setState('success')
    setTimeout(() => router.push('/affiliate'), 2500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-200">
            <Gift className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-black text-gray-900">Program Affiliate</h1>
          <p className="text-sm text-gray-500 mt-1">SyababFresh</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          {/* Loading */}
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
              <p className="text-sm text-gray-500">Menyemak jemputan...</p>
            </div>
          )}

          {/* Need login */}
          {state === 'need_login' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto">
                <LogIn className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Log masuk dahulu</p>
                <p className="text-sm text-gray-500 mt-1">Anda perlu log masuk atau daftar akaun sebelum boleh join program affiliate.</p>
              </div>
              <div className="space-y-2">
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/jadi-affiliate?token=${token}`)}`}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-bold py-2.5 rounded-xl hover:bg-purple-700 transition-colors text-sm"
                >
                  <LogIn className="h-4 w-4" />
                  Log Masuk
                </Link>
                <Link
                  href={`/daftar?redirect=${encodeURIComponent(`/jadi-affiliate?token=${token}`)}`}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                >
                  Daftar Akaun Baru
                </Link>
              </div>
            </div>
          )}

          {/* Ready to join */}
          {state === 'ready' && (
            <div className="space-y-5">
              <div className="text-center">
                <p className="font-bold text-gray-900">Anda dijemput!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Sertai program affiliate SyababFresh dan mula jana komisyen RM dari setiap order yang anda perkenalkan.
                </p>
              </div>

              {/* Perks */}
              <div className="space-y-2.5">
                {[
                  { label: 'Komisyen % dari setiap order', sub: 'Dikira automatik bila order selesai' },
                  { label: 'Keluarkan duit terus ke bank', sub: 'Minimum RM10, tiada had maksimum' },
                  { label: 'Dashboard peribadi', sub: 'Pantau komisyen & sejarah pengeluaran' },
                ].map(p => (
                  <div key={p.label} className="flex items-start gap-3 bg-purple-50 rounded-xl px-3.5 py-3">
                    <CheckCircle2 className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleJoin}
                className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 active:scale-[0.98] transition-all shadow-lg shadow-purple-200 text-sm"
              >
                Sertai Sekarang
              </button>
              <p className="text-center text-xs text-gray-400">
                Log masuk sebagai <span className="font-semibold text-gray-600">{user?.email}</span>
              </p>
            </div>
          )}

          {/* Joining */}
          {state === 'joining' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
              <p className="text-sm text-gray-500">Mendaftarkan anda...</p>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <p className="font-black text-gray-900 text-lg">Selamat datang, Affiliate!</p>
              <p className="text-sm text-gray-500">Anda kini sebahagian dari program affiliate SyababFresh. Menuju ke dashboard...</p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="text-center space-y-3 py-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <XCircle className="h-7 w-7 text-red-400" />
              </div>
              <p className="font-bold text-gray-900">Link tidak sah</p>
              <p className="text-sm text-gray-500">{errorMsg}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function JadiAffiliatePage() {
  return (
    <Suspense>
      <JoinContent />
    </Suspense>
  )
}
