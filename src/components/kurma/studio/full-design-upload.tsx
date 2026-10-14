'use client'

// Mod "upload design penuh": imej dimampat di klien (≤1600px WebP), PDF dihantar terus (≤8MB).
// POST /api/kurma/upload (kind=design). Untuk lead yang dah ada artwork siap dari designer.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, UploadCloud, FileText, X } from 'lucide-react'
import { compressImage } from '@/lib/gift-mockup'

export interface DesignAsset { url: string; name: string; type: string; previewUrl: string | null }

export function FullDesignUpload({ design, onChange }: { design: DesignAsset | null; onChange: (d: DesignAsset | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 8 * 1024 * 1024) { toast.error('Fail terlalu besar (maks 8MB)'); return }
    setBusy(true)
    try {
      let upload: File = f
      let previewUrl: string | null = null
      if (f.type.startsWith('image/')) {
        const c = await compressImage(f, 1600, 0.85)
        if (!c) { toast.error('Imej tak dapat dibaca — guna PNG, JPG, WebP atau PDF'); return }
        upload = new File([c.blob], 'design.webp', { type: 'image/webp' })
        previewUrl = URL.createObjectURL(c.blob)
      }
      const fd = new FormData(); fd.append('file', upload); fd.append('kind', 'design')
      const res = await fetch('/api/kurma/upload', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.url) { toast.error(j.error ?? 'Upload gagal'); return }
      if (design?.previewUrl) URL.revokeObjectURL(design.previewUrl)
      onChange({ url: j.url, name: f.name, type: j.type ?? f.type, previewUrl })
    } catch {
      toast.error('Upload gagal — cuba lagi')
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Design penuh anda</p>
      <p className="text-[12px] text-gray-500 mt-1">Artwork siap (dari designer anda) — PNG/JPG/WebP/PDF. Die-line & spesifikasi cetak kami sediakan.</p>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {design && (
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-2 pr-3">
            {design.previewUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={design.previewUrl} alt="Design anda" className="h-12 w-12 object-cover rounded-lg border border-gray-100" />
              : <div className="h-12 w-12 rounded-lg bg-gray-50 border border-gray-100 grid place-items-center text-gray-400"><FileText className="h-5 w-5" /></div>}
            <div className="text-[12px] font-semibold text-gray-800 truncate max-w-[180px]">{design.name}</div>
            <button type="button" onClick={() => { if (design.previewUrl) URL.revokeObjectURL(design.previewUrl); onChange(null) }} aria-label="Buang design" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
          </div>
        )}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 hover:border-gray-400 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{design ? 'Tukar fail' : 'Upload design'}
        </button>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={pick} className="hidden" aria-label="Pilih fail design" />
      </div>
    </div>
  )
}
