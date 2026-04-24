'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Profile } from '@/types'

export function ProfileForm({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: profile.full_name ?? '',
    phone: profile.phone ?? '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name, phone: form.phone })
      .eq('id', profile.id)

    if (error) {
      toast.error('Gagal kemaskini profil')
    } else {
      toast.success('Profil dikemaskini')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nama Penuh</label>
        <input
          name="full_name"
          value={form.full_name}
          onChange={handleChange}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          No. Telefon <span className="text-brand-red-500">*</span>
        </label>
        <input
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          required
          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400 ${
            !form.phone ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
          }`}
          placeholder="011-1234 5678"
        />
        {!form.phone && (
          <p className="text-xs text-yellow-600 mt-1">Wajib untuk notifikasi WhatsApp</p>
        )}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-brand-fresh-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-fresh-600 disabled:opacity-60 transition-colors text-sm"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {loading ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  )
}
