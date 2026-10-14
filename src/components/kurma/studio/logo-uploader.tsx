'use client'

// Upload logo: mampat di klien (→ WebP ≤1200px, kekal alpha; TIADA Supabase transform) →
// POST /api/kurma/upload (kind=logo, magic-byte disahkan server). Simpan blobUrl tempatan
// untuk preview & eksport canvas (tak mencemar canvas).
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, UploadCloud, X } from 'lucide-react'
import { compressImage } from '@/lib/gift-mockup'

export interface LogoAsset { url: string; blobUrl: string; w: number; h: number; name: string }

export function LogoUploader({ logo, onChange }: { logo: LogoAsset | null; onChange: (l: LogoAsset | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const c = await compressImage(f, 1200, 0.9)
      if (!c) { toast.error('Fail tak dapat dibaca — guna PNG, JPG atau WebP'); return }
      const fd = new FormData()
      fd.append('file', new File([c.blob], 'logo.webp', { type: 'image/webp' }))
      fd.append('kind', 'logo')
      const res = await fetch('/api/kurma/upload', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.url) { toast.error(j.error ?? 'Upload gagal'); return }
      if (logo) URL.revokeObjectURL(logo.blobUrl)
      onChange({ url: j.url, blobUrl: URL.createObjectURL(c.blob), w: c.w, h: c.h, name: f.name })
    } catch {
      toast.error('Upload gagal — cuba lagi')
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  function remove() {
    if (logo) URL.revokeObjectURL(logo.blobUrl)
    onChange(null)
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">2. Logo anda</p>
      <div className="mt-2 flex items-center gap-3">
        {logo ? (
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-2 pr-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.blobUrl} alt="Logo anda" className="h-12 w-12 object-contain rounded-lg bg-[#FBFAF7] border border-gray-100" />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-gray-800 truncate max-w-[160px]">{logo.name}</div>
              <div className="text-[11px] text-gray-400">{logo.w}×{logo.h}</div>
            </div>
            <button type="button" onClick={remove} aria-label="Buang logo" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
          </div>
        ) : null}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 hover:border-gray-400 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{logo ? 'Tukar logo' : 'Upload logo'}
        </button>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} className="hidden" aria-label="Pilih fail logo" />
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">PNG latar lutsinar paling cantik · JPG/WebP pun boleh · maks 8MB.</p>
    </div>
  )
}
