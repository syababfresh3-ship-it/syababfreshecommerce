'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X, UserPlus } from 'lucide-react'

export function CreateUserForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
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
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error('Name dan email wajib diisi')
      return
    }

    setLoading(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Failed buat akaun')
    } else {
      toast.success('Akaun customer success dibuat')
      onClose()
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-red-100 p-1.5 rounded-lg">
            <UserPlus className="h-4 w-4 text-red-600" />
          </div>
          <h2 className="font-bold text-gray-900">Customer New</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Name Penuh <span className="text-red-500">*</span>
            </label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
              placeholder="Ahmad bin Ali"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="email@contoh.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">No. Phone</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="011-1234 5678"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Kata Laluan
              <span className="text-gray-400 font-normal ml-1">(kosong = customer set sendiri via reset password)</span>
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 6 aksara"
              minLength={form.password ? 6 : undefined}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? 'Mencipta...' : 'Buat Akaun'}
          </button>
        </div>
      </form>
    </div>
  )
}
