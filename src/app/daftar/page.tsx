'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function DaftarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  })

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
        data: { full_name: form.full_name },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // Update phone if provided — use user from signUp response, not getUser()
    if (form.phone && data.user) {
      await supabase.from('profiles').update({ phone: form.phone }).eq('id', data.user.id)
    }

    toast.success('Akaun berjaya dibuat! Selamat datang 🎉')
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">SyababFresh</h1>
          <p className="text-gray-500 text-sm mt-1">Buat akaun baru</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Penuh</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Ahmad bin Ali"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="email@contoh.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">No. Telefon</label>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="011-1234 5678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kata Laluan</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Min. 6 aksara"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
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
