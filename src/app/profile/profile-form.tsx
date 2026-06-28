'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Profile } from '@/types'

export function ProfileForm({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: profile.full_name ?? '',
    phone: profile.phone ?? '',
    whatsapp_optin: profile.whatsapp_optin ?? true,
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    // Get current auth user to sync email
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Sesi tamat. Sila log masuk semula.')
      setLoading(false)
      return
    }

    // Upsert — handles edge case where profile row was never created
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email ?? null,
        full_name: form.full_name,
        phone: form.phone,
        whatsapp_optin: form.whatsapp_optin,
      })

    if (error) {
      toast.error('Gagal kemaskini profil: ' + error.message)
    } else {
      toast.success('Profil dikemaskini')
      router.refresh()
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
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red-400"
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
          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red-400 ${
            !form.phone ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
          }`}
          placeholder="011-1234 5678"
        />
        {!form.phone && (
          <p className="text-xs text-yellow-600 mt-1">Wajib untuk notifikasi WhatsApp</p>
        )}
      </div>
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Promosi WhatsApp</p>
          <p className="text-xs text-gray-500 mt-0.5">Terima tawaran eksklusif & diskaun via WhatsApp</p>
        </div>
        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, whatsapp_optin: !p.whatsapp_optin }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.whatsapp_optin ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.whatsapp_optin ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-brand-red-600 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-red-600 disabled:opacity-60 transition-colors text-sm"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {loading ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  )
}
