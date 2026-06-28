'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, BarChart2, Tag, ExternalLink, Megaphone, Zap } from 'lucide-react'

interface Settings {
  meta_pixel_id: string
  google_ads_id: string
  google_ads_label: string
  gtm_id: string
  flash_sale_label: string
  flash_sale_ends_at: string
  flash_sale_promo_code: string
  catalog_announcement: string
}

const EMPTY: Settings = {
  meta_pixel_id: '', google_ads_id: '', google_ads_label: '', gtm_id: '',
  flash_sale_label: '', flash_sale_ends_at: '', flash_sale_promo_code: '',
  catalog_announcement: '',
}

export default function MarketingPage() {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/marketing')
      .then(r => r.json())
      .then(data => { setSettings(data); setLoading(false) })
  }, [])

  function set(key: keyof Settings) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setSettings(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/marketing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    if (res.ok) toast.success('Settings disave')
    else toast.error('Failed save')
  }

  const card = 'bg-white rounded-2xl border border-gray-100 p-5 space-y-4'
  const field = (label: string, hint: string, key: keyof Settings, placeholder: string) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={settings[key]}
        onChange={set(key)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
      />
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Tracking Iklan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pixel dan conversion tracking untuk FB Ads & Google Ads
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* Pengumuman Katalog */}
        <div className={card}>
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Pengumuman Katalog</p>
              <p className="text-xs text-gray-400">Strip di atas senarai produk di skrin Katalog</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Teks Pengumuman</label>
            <input type="text" value={settings.catalog_announcement} onChange={set('catalog_announcement')}
              placeholder="Pesan sebelum 12 tgh hari — sampai hari ini di Lembah Klang" suppressHydrationWarning
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            <p className="text-xs text-gray-400 mt-1">Kosong = guna default. Taip <span className="font-mono font-semibold">off</span> untuk sembunyikan strip.</p>
          </div>
        </div>

        {/* Flash Sale */}
        <div className={card}>
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white fill-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Flash Sale Countdown</p>
              <p className="text-xs text-gray-400">Banner countdown muncul di homepage secara automatik</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Title Flash Sale</label>
            <input type="text" value={settings.flash_sale_label} onChange={set('flash_sale_label')}
              placeholder="Flash Sale! Diskaun 30% untuk all buah" suppressHydrationWarning
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Date Tamat</label>
            <input type="datetime-local" value={settings.flash_sale_ends_at} onChange={set('flash_sale_ends_at')}
              suppressHydrationWarning
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            <p className="text-xs text-gray-400 mt-1">Banner hilang otomatik bila masa tamat</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Kod Promo (selectan)</label>
            <input type="text" value={settings.flash_sale_promo_code} onChange={set('flash_sale_promo_code')}
              placeholder="FLASH30" suppressHydrationWarning
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          {settings.flash_sale_ends_at && !settings.flash_sale_label && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">⚠️ Isi title untuk banner muncul</p>
          )}
          {settings.flash_sale_label && (
            <button type="button" onClick={() => setSettings(p => ({ ...p, flash_sale_ends_at: '', flash_sale_label: '', flash_sale_promo_code: '' }))}
              className="text-xs text-red-500 hover:underline">
              × Deletekan flash sale
            </button>
          )}
        </div>

        {/* Meta Pixel */}
        <div className={card}>
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Meta Pixel (Facebook Ads)</p>
              <p className="text-xs text-gray-400">Events: PageView, AddToCart, InitiateCheckout, Purchase</p>
            </div>
            <a
              href="https://business.facebook.com/events_manager"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-blue-500 flex items-center gap-1"
            >
              Events Manager <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {field(
            'Pixel ID',
            'Cth: 1234567890123456 — jumpa di Meta Events Manager > Data Sources',
            'meta_pixel_id',
            '1234567890123456'
          )}
        </div>

        {/* Google Ads */}
        <div className={card}>
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Google Ads</p>
              <p className="text-xs text-gray-400">Conversion tracking terus (tanpa GTM)</p>
            </div>
            <a
              href="https://ads.google.com/aw/conversions"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-green-600 flex items-center gap-1"
            >
              Conversions <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {field(
            'Conversion ID',
            'Cth: AW-123456789 — jumpa di Google Ads > Tools > Conversions',
            'google_ads_id',
            'AW-123456789'
          )}
          {field(
            'Conversion Label',
            'Cth: AbCdEfGhIjKlMnOp — untuk event "Purchase"',
            'google_ads_label',
            'AbCdEfGhIjKlMnOp'
          )}
        </div>

        {/* GTM */}
        <div className={card}>
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
              <Tag className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Google Tag Manager</p>
              <p className="text-xs text-gray-400">Alternatif — isi ini ATAU Google Ads di atas</p>
            </div>
          </div>
          {field(
            'GTM Container ID',
            'Cth: GTM-XXXXXXX — isi ini jika nak urus all tags via GTM',
            'gtm_id',
            'GTM-XXXXXXX'
          )}
          {settings.gtm_id && settings.google_ads_id && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ GTM diisi — Google Ads direct script tidak akan diload. Pastikan conversion tag ada dalam GTM.
            </p>
          )}
        </div>

        {/* Status */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700 mb-2">Status semasa:</p>
          <p>{settings.meta_pixel_id ? `✅ Meta Pixel: ${settings.meta_pixel_id}` : '⬜ Meta Pixel: Belum diset'}</p>
          <p>{settings.google_ads_id ? `✅ Google Ads: ${settings.google_ads_id}` : '⬜ Google Ads: Belum diset'}</p>
          <p>{settings.gtm_id ? `✅ GTM: ${settings.gtm_id}` : '⬜ GTM: Belum diset'}</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-brand-fresh-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </form>
    </div>
  )
}
