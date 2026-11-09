'use client'

// Login POS — email + kata laluan sahaja (tiada OAuth → tiada kebergantungan redirect URL hos POS).
// Input besar untuk tablet. ?error=no_access bila akaun login tiada akses POS (pos_staff / admin). UI EN.
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const redirect = sp.get('redirect')?.startsWith('/pos') ? sp.get('redirect')! : '/pos/sell'
  const noAccess = sp.get('error') === 'no_access'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { toast.error('Wrong email or password'); setLoading(false); return }
    router.push(redirect)
    router.refresh()
  }
  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/pos/login')
    router.refresh()
  }

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">SF POS</h1>
          <p className="text-[13px] text-gray-500 mt-1">Sign in with the counter device account</p>
        </div>
        {noAccess && (
          <div className="mb-5 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-[13px] text-amber-900">
            <p className="font-bold">This account has no POS access.</p>
            <p className="mt-1">Ask an admin to add it under Admin → POS → Cashiers &amp; Access, or sign in with another account.</p>
            <button type="button" onClick={signOut} className="mt-3 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-white border border-amber-300 font-bold"><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required autoComplete="username" inputMode="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full h-14 px-4 rounded-2xl border border-gray-300 bg-white text-[16px] font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input type="password" required autoComplete="current-password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full h-14 px-4 rounded-2xl border border-gray-300 bg-white text-[16px] font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button type="submit" disabled={loading} className="w-full h-14 rounded-2xl text-white text-[16px] font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2" style={{ background: '#E11D2A' }}>
            {loading && <Loader2 className="h-5 w-5 animate-spin" />} Sign in
          </button>
        </form>
        <p className="text-center text-[11px] text-gray-400 mt-6">Cashiers are selected by PIN after signing in.</p>
      </div>
    </div>
  )
}

export default function PosLoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>
}
