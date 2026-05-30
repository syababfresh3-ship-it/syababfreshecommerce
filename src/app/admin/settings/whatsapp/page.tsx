'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Save, RefreshCw, RotateCcw } from 'lucide-react'
import { DEFAULT_TEMPLATES } from '@/lib/wa-templates'

const TEMPLATES = [
  {
    key: 'wa_tmpl_greeting',
    label: 'Greeting (Opening)',
    description: 'First line of every message',
    vars: ['{name}'],
  },
  {
    key: 'wa_tmpl_order_received',
    label: '📋 Order Received',
    description: 'Sent when COD/Bank Transfer order is placed',
    vars: ['{name}', '{order_number}'],
  },
  {
    key: 'wa_tmpl_payment_confirmed',
    label: '💳 Payment Confirmed (FPX)',
    description: 'Sent when FPX payment is completed',
    vars: ['{name}', '{order_number}'],
  },
  {
    key: 'wa_tmpl_confirmed',
    label: '✅ Order Confirmed',
    description: 'Admin confirms the order',
    vars: ['{name}', '{order_number}'],
  },
  {
    key: 'wa_tmpl_preparing',
    label: '🧺 Preparing',
    description: 'Order is being prepared',
    vars: ['{name}', '{order_number}'],
  },
  {
    key: 'wa_tmpl_delivering',
    label: '🚚 Out for Delivery',
    description: 'Order is on the way — {tracking_url} will be appended if available',
    vars: ['{name}', '{order_number}', '{tracking_url}'],
  },
  {
    key: 'wa_tmpl_delivered',
    label: '🎉 Delivered',
    description: 'Order has been delivered',
    vars: ['{name}', '{order_number}'],
  },
  {
    key: 'wa_tmpl_cancelled',
    label: '❌ Cancelled',
    description: 'Order has been cancelled',
    vars: ['{name}', '{order_number}'],
  },
  {
    key: 'wa_tmpl_footer',
    label: 'Footer (Closing)',
    description: 'Last line of every message',
    vars: [],
  },
]

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings/whatsapp')
      .then(r => r.json())
      .then(data => {
        // Merge with defaults for any missing keys
        const merged: Record<string, string> = {}
        for (const t of TEMPLATES) {
          merged[t.key] = data[t.key] ?? DEFAULT_TEMPLATES[t.key] ?? ''
        }
        setTemplates(merged)
      })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templates),
      })
      if (!res.ok) { toast.error('Failed to save'); return }
      toast.success('WhatsApp templates saved!')
    } finally { setSaving(false) }
  }

  function reset(key: string) {
    setTemplates(prev => ({ ...prev, [key]: DEFAULT_TEMPLATES[key] ?? '' }))
    toast.info('Reset to default')
  }

  function buildPreview(key: string) {
    const tpl = templates[key] ?? ''
    const greeting = templates.wa_tmpl_greeting ?? DEFAULT_TEMPLATES.wa_tmpl_greeting
    const footer = templates.wa_tmpl_footer ?? DEFAULT_TEMPLATES.wa_tmpl_footer

    if (key === 'wa_tmpl_greeting' || key === 'wa_tmpl_footer') {
      return tpl.replace('{name}', 'Ahmad')
    }

    const lines = [
      greeting.replace('{name}', 'Ahmad'),
      '',
      tpl.replace('{name}', 'Ahmad').replace('{order_number}', 'LP-20260530-0001').replace('{total}', 'RM89.00').replace('{tracking_url}', 'https://tracking.ninjavan.co/my/...'),
      '',
      '📦 No. Pesanan: *LP-20260530-0001*',
    ]

    if (key === 'wa_tmpl_delivering') {
      lines.push('')
      lines.push('🔗 *Link Penghantaran:*')
      lines.push('https://tracking.ninjavan.co/my/...')
    }

    lines.push('')
    lines.push(footer)
    return lines.join('\n')
  }

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Message Templates
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Customise messages sent to customers at each order stage</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {/* Variable hint */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-sm text-blue-700">
        <p className="font-bold mb-1">Available variables:</p>
        <p className="text-xs font-mono">{'{name}'} — customer name &nbsp;·&nbsp; {'{order_number}'} — order no. &nbsp;·&nbsp; {'{total}'} — order total &nbsp;·&nbsp; {'{tracking_url}'} — tracking link</p>
        <p className="text-xs mt-1 opacity-70">Use *text* for bold in WhatsApp</p>
      </div>

      <div className="space-y-4">
        {TEMPLATES.map(t => (
          <div key={t.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreview(preview === t.key ? null : t.key)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {preview === t.key ? 'Hide Preview' : 'Preview'}
                </button>
                <button
                  onClick={() => reset(t.key)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Reset to default"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="p-5">
              <textarea
                value={templates[t.key] ?? ''}
                onChange={e => setTemplates(prev => ({ ...prev, [t.key]: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300 resize-y"
                placeholder={DEFAULT_TEMPLATES[t.key] ?? ''}
              />
              {t.vars.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {t.vars.map(v => (
                    <button key={v} type="button"
                      onClick={() => setTemplates(prev => ({ ...prev, [t.key]: (prev[t.key] ?? '') + v }))}
                      className="text-[11px] font-mono bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md transition-colors">
                      + {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {preview === t.key && (
              <div className="px-5 pb-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Preview (example data)</p>
                <div className="bg-[#ECE5DD] rounded-2xl p-4">
                  <div className="bg-white rounded-xl rounded-tl-none p-3 shadow-sm max-w-xs">
                    <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
                      {buildPreview(t.key)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save All Templates'}
        </button>
      </div>
    </div>
  )
}
