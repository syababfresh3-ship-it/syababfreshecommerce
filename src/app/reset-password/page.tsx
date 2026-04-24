'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, KeyRound } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Kata laluan minimum 6 aksara')
      return
    }
    if (password !== confirm) {
      toast.error('Kata laluan tidak sepadan')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error('Gagal kemaskini kata laluan')
    } else {
      toast.success('Kata laluan berjaya ditukar')
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 bg-brand-red-100 rounded-full mb-3">
            <KeyRound className="h-5 w-5 text-brand-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Tetapkan Kata Laluan Baru</h1>
          <p className="text-sm text-gray-500 mt-1">Masukkan kata laluan baru untuk akaun anda</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Kata Laluan Baru
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Minimum 6 aksara"
                suppressHydrationWarning
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Sahkan Kata Laluan
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Taip semula kata laluan"
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
              {loading ? 'Menyimpan...' : 'Simpan Kata Laluan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
