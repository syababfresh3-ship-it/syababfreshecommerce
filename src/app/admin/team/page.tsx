'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Users, Plus, Trash2, Loader2, ShieldCheck, X, Eye, EyeOff } from 'lucide-react'

interface StaffMember {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  is_admin: boolean
  created_at: string
}

export default function TeamPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/team')
    if (res.ok) {
      const data = await res.json()
      setStaff(data.staff ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addStaff() {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error('Name dan email wajib diisi')
      return
    }
    if (!form.password || form.password.length < 8) {
      toast.error('Password minimum 8 karakter')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, is_admin: true }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed tambah staf')
    } else {
      toast.success(`${form.full_name} success ditambah sebagai admin`)
      setForm({ full_name: '', email: '', phone: '', password: '' })
      setShowForm(false)
      await load()
    }
    setSubmitting(false)
  }

  async function removeAdmin(member: StaffMember) {
    if (!confirm(`Tarik akses admin dari ${member.full_name ?? member.email}?`)) return
    setRemoving(member.id)
    const res = await fetch(`/api/admin/team/${member.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed tarik akses')
    } else {
      toast.success(`Akses admin ${member.full_name ?? member.email} ditarik`)
      setStaff(prev => prev.filter(s => s.id !== member.id))
    }
    setRemoving(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">User Admin</h1>
            <p className="text-sm text-gray-400 mt-0.5">{staff.length} staf mempunyai akses admin</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Batal' : 'Add Staf'}
        </button>
      </div>

      {/* Add staff form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 space-y-4">
          <p className="font-semibold text-gray-900 text-sm">Akaun Admin New</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Name Penuh *</label>
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(v => ({ ...v, full_name: e.target.value }))}
                placeholder="Name staf"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">No. Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(v => ({ ...v, phone: e.target.value }))}
                placeholder="01x-xxxxxxx"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(v => ({ ...v, email: e.target.value }))}
                placeholder="staf@syababfresh.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Kata Laluan *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(v => ({ ...v, password: e.target.value }))}
                  placeholder="Min. 8 karakter"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
            <p className="text-xs text-indigo-700">Akaun ini akan mempunyai akses penuh ke all halaman admin.</p>
          </div>
          <button
            onClick={addStaff}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitting ? 'Mencipta akaun...' : 'Cipta Akaun Admin'}
          </button>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No staf admin lagi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(member => (
            <div key={member.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700 font-bold text-sm">
                {(member.full_name ?? member.email ?? '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{member.full_name ?? '—'}</p>
                <p className="text-xs text-gray-400">{member.email}</p>
                {member.phone && <p className="text-xs text-gray-400">{member.phone}</p>}
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg shrink-0">
                <ShieldCheck className="h-3.5 w-3.5" />Admin
              </span>
              <button
                onClick={() => removeAdmin(member)}
                disabled={removing === member.id}
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Tarik akses admin"
              >
                {removing === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 text-center">
        Menarik akses tidak memadam akaun — staf masih boleh log masuk sebagai customer biasa.
      </p>
    </div>
  )
}
