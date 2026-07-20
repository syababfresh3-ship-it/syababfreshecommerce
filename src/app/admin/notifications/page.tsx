'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Bell, Send, Loader2, Users, Megaphone, ShoppingBag, Package, X } from 'lucide-react'
import { PushSubscribeButton } from '@/components/store/push-subscribe'

const TEMPLATES = [
  {
    label: 'Promotions New',
    icon: Megaphone,
    color: 'bg-red-50 text-red-600 border-red-200',
    title: 'Tawaran Istimewa! 🎉',
    body: 'Jangan lepaskan promotions terhad hari ini. Beli sekarang!',
  },
  {
    label: 'Restock Product',
    icon: Package,
    color: 'bg-green-50 text-green-600 border-green-200',
    title: 'Stock New Tiba! 🍍',
    body: 'Product kegemaran anda kini tersedia semula. Pesan sebelum habis!',
  },
  {
    label: 'Peringatan Orders',
    icon: ShoppingBag,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    title: 'Jangan Lupa Pesan 🛒',
    body: 'Buah segar menunggu anda. Pesan hari ini untuk pengsendan esok!',
  },
]

export default function AdminNotificationsPage() {
  const [form, setForm] = useState({ title: '', body: '', url: '/' })
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<{ sent: number; total: number } | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setForm(p => ({ ...p, title: t.title, body: t.body }))
    setActiveTemplate(t.label)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.body) { toast.error('Title dan mesej wajib diisi'); return }
    if (!confirm(`Send notifications ke SEMUA customer yang langgan?\n\n"${form.title}"`)) return

    setLoading(true)
    setLastResult(null)

    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.title, body: form.body, url: form.url }),
    })

    const text = await res.text()
    let data: any = {}
    try { data = JSON.parse(text) } catch { /* empty body */ }

    if (!res.ok) {
      toast.error(data.error ?? 'Failed send notifications')
    } else if (data.skipped) {
      toast.info('No customer yang langgan notifications')
    } else {
      setLastResult({ sent: data.sent, total: data.total })
      toast.success(`Notifications disend ke ${data.sent} peranti`)
    }
    setLoading(false)
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Broadcast Notifications</h1>
        <p className="text-sm text-gray-400 mt-0.5">Send push notification ke all customer yang active</p>
      </div>

      {/* Admin subscribe panel */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-blue-900 text-sm">Notifications Order New untuk Admin</p>
          <p className="text-xs text-blue-600 mt-0.5">Activekan supaya dapat push notification bila ada order masuk atau FPX dibayar</p>
        </div>
        <PushSubscribeButton />
      </div>

      {/* Templates */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Template Pantas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map(t => {
            const Icon = t.icon
            const isActive = activeTemplate === t.label
            return (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                className={`flex flex-col items-start gap-2 p-3.5 rounded-2xl border text-left transition-all ${
                  isActive ? 'border-gray-900 bg-gray-50 shadow-sm' : `${t.color} hover:opacity-80`
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-bold leading-tight">{t.label}</span>
                <span className="text-[10px] text-current opacity-70 leading-tight">{t.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-4">Tulis Notifications</h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Title *</label>
            <input
              value={form.title}
              onChange={e => { setForm(p => ({ ...p, title: e.target.value })); setActiveTemplate(null) }}
              placeholder="cth: Tawaran Istimewa! 🎉"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mesej *</label>
            <textarea
              rows={3}
              value={form.body}
              onChange={e => { setForm(p => ({ ...p, body: e.target.value })); setActiveTemplate(null) }}
              placeholder="cth: Jangan lepaskan promotions terhad hari ini..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">URL Destinasi</label>
            <input
              value={form.url}
              onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              placeholder="/products"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          {/* Live preview */}
          {(form.title || form.body) && (
            <div className="bg-gray-900 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-semibold">Preview Notifications</p>
              <div className="bg-white/10 rounded-xl px-4 py-3 flex items-start gap-3">
                <div className="bg-red-600 p-2 rounded-lg shrink-0">
                  <Bell className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-tight">{form.title || '—'}</p>
                  {form.body && <p className="text-xs text-gray-400 mt-0.5 leading-snug">{form.body}</p>}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.title || !form.body}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? 'Mengsend...' : 'Send ke All Customer'}
          </button>
        </form>
      </div>

      {/* Result */}
      {lastResult && (
        <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
          <div className="bg-green-100 p-2.5 rounded-xl shrink-0">
            <Users className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-green-800">Success disend!</p>
            <p className="text-xs text-green-600 mt-0.5">
              {lastResult.sent} daripada {lastResult.total} peranti menerima notifications
            </p>
          </div>
          <button onClick={() => setLastResult(null)} className="ml-auto text-green-400 hover:text-green-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
