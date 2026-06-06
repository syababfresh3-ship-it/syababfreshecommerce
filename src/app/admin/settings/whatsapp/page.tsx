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
    label: '📋 Order Received (COD/Bank)',
    description: 'Mesej penuh bila order COD/Bank Transfer dibuat (LP). Reply prompt + footer ditambah automatik.',
    vars: ['{name}', '{order_number}', '{lp_title}', '{items}', '{total}', '{payment_method}', '{app_url}'],
  },
  {
    key: 'wa_tmpl_payment_confirmed',
    label: '💳 Payment Confirmed (FPX)',
    description: 'Mesej penuh bila bayaran FPX berjaya (LP). Reply prompt + footer ditambah automatik.',
    vars: ['{name}', '{order_number}', '{lp_title}', '{items}', '{total}', '{app_url}'],
  },
  {
    key: 'wa_tmpl_reply_prompt',
    label: '💬 Reply Prompt',
    description: 'Ajakan customer balas "YA" pada notifikasi order LP — untuk two-way comms (kurangkan risiko WA banned)',
    vars: [],
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
  const [trackingMode, setTrackingMode] = useState<'murpati' | 'off'>('murpati')
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
        setTrackingMode(data.wa_customer_tracking === 'off' ? 'off' : 'murpati')
      })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...templates, wa_customer_tracking: trackingMode }),
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
    const tpl = templates[key] ?? DEFAULT_TEMPLATES[key] ?? ''
    const sample: Record<string, string> = {
      name: 'Ahmad',
      order_number: 'LP-20260530-0001',
      lp_title: 'Pre-Order Cherry Uzbekistan',
      items: '• Cherry Uzbekistan (500g) × 2 — RM89.00',
      total: '89.00',
      payment_method: 'Bayar Semasa Terima (COD)',
      app_url: 'https://shop.syababfresh.my',
      tracking_url: 'https://tracking.ninjavan.co/my/...',
    }
    const render = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => sample[k] ?? `{${k}}`)
    const footer = render(templates.wa_tmpl_footer ?? DEFAULT_TEMPLATES.wa_tmpl_footer)
    const replyPrompt = render(templates.wa_tmpl_reply_prompt ?? DEFAULT_TEMPLATES.wa_tmpl_reply_prompt)

    // Standalone snippets
    if (key === 'wa_tmpl_greeting' || key === 'wa_tmpl_footer' || key === 'wa_tmpl_reply_prompt') {
      return render(tpl)
    }

    // Full-body order-confirmation messages: body + reply prompt + footer
    if (key === 'wa_tmpl_order_received' || key === 'wa_tmpl_payment_confirmed') {
      return [render(tpl), '', replyPrompt, '', footer].join('\n')
    }

    // Status updates: greeting + body + order number (+ tracking) + footer
    const greeting = render(templates.wa_tmpl_greeting ?? DEFAULT_TEMPLATES.wa_tmpl_greeting)
    const lines = [greeting, '', render(tpl), '', `📦 No. Pesanan: *${sample.order_number}*`]
    if (key === 'wa_tmpl_delivering') {
      lines.push('', '🔗 *Link Penghantaran:*', sample.tracking_url)
    }
    lines.push('', footer)
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
        <p className="text-xs font-mono">{'{name}'} — customer name &nbsp;·&nbsp; {'{order_number}'} — order no. &nbsp;·&nbsp; {'{total}'} — order total &nbsp;·&nbsp; {'{tracking_url}'} — tracking link &nbsp;·&nbsp; {'{items}'} — senarai item &nbsp;·&nbsp; {'{lp_title}'} — tajuk LP &nbsp;·&nbsp; {'{payment_method}'} — kaedah bayar &nbsp;·&nbsp; {'{app_url}'} — link app</p>
        <p className="text-xs mt-1 opacity-70">Use *text* for bold in WhatsApp</p>
      </div>

      {/* Saluran WA tracking ke pelanggan — Murpati vs OFF (guna ReplyLa) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <p className="text-sm font-bold text-gray-900">Saluran WhatsApp Tracking</p>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">
          Kawal mesej tracking/penghantaran ke pelanggan. Tukar <span className="font-semibold">OFF</span> bila guna
          blast ReplyLa — elak mesej berganda &amp; risiko ban Murpati. Email &amp; push tetap dihantar.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTrackingMode('murpati')}
            className={`text-left rounded-xl border px-4 py-3 transition-colors ${trackingMode === 'murpati' ? 'border-green-500 bg-green-50 ring-1 ring-green-400' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <p className="text-sm font-bold text-gray-900">Murpati (auto)</p>
            <p className="text-xs text-gray-500 mt-0.5">Hantar WA automatik via gateway (tingkah laku asal)</p>
          </button>
          <button
            type="button"
            onClick={() => setTrackingMode('off')}
            className={`text-left rounded-xl border px-4 py-3 transition-colors ${trackingMode === 'off' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <p className="text-sm font-bold text-gray-900">OFF — guna ReplyLa</p>
            <p className="text-xs text-gray-500 mt-0.5">Murpati tak hantar WA; blast tracking guna ReplyLa</p>
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Tekan <span className="font-semibold">Save All</span> untuk simpan pilihan.</p>
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
