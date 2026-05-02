'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Store } from 'lucide-react'
import { ImageUploader } from '@/components/admin/image-uploader'
import Image from 'next/image'

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings/logo')
      .then(r => r.json())
      .then(d => {
        setLogoUrl(d.logo_url ?? null)
        setPendingUrl(d.logo_url ?? null)
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/admin/settings/logo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: pendingUrl }),
    })
    setSaving(false)
    if (res.ok) {
      setLogoUrl(pendingUrl)
      toast.success('Logo dikemaskini')
    } else {
      toast.error('Gagal simpan logo')
    }
  }

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
        <h1 className="text-xl font-bold text-gray-900">Tetapan Kedai</h1>
        <p className="text-sm text-gray-500 mt-1">Kemaskini logo dan identiti jenama</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-50">
          <div className="w-8 h-8 rounded-lg bg-brand-fresh-100 flex items-center justify-center">
            <Store className="h-4 w-4 text-brand-fresh-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Logo Kedai</p>
            <p className="text-xs text-gray-400">Dipaparkan di header website. Saiz cadangan: 200×60px</p>
          </div>
        </div>

        {/* Current logo preview */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Logo Semasa</p>
          <div className="h-14 w-48 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden px-3">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo semasa"
                width={180}
                height={48}
                className="object-contain h-10 w-auto"
              />
            ) : (
              <span className="text-xl font-bold text-gradient-brand">SyababFresh</span>
            )}
          </div>
        </div>

        {/* Upload new logo */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Upload Logo Baru</p>
          <ImageUploader
            currentUrl={pendingUrl}
            onUpload={(url) => setPendingUrl(url)}
            onRemove={() => setPendingUrl(null)}
            bucket="brand-assets"
            label="Logo (PNG, SVG, JPG · Max 5MB)"
            aspectRatio="aspect-[3/1]"
          />
          {pendingUrl && pendingUrl !== logoUrl && (
            <p className="text-xs text-amber-600 mt-2">⚠️ Klik Simpan untuk apply logo baru</p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || pendingUrl === logoUrl}
          className="w-full flex items-center justify-center gap-2 bg-brand-fresh-500 text-white font-bold py-3 rounded-2xl disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Logo
        </button>
      </div>
    </div>
  )
}
