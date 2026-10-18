import { DIECUT_TEMPLATES, type DiecutTemplate } from '@/lib/gift'

// Crop CSS satu muka kotak (lalai: muka atas) dari helaian artwork die-cut — tanpa canvas/JS.
// Matematik: pembungkus = kotak muka (aspect-ratio = (fx·W)/(fy·H)); imej helaian diletak absolute
// dengan lebar 100/fx % (helaian relatif pembungkus) & dianjak -x0/fx (lebar) / -y0/fy (tinggi).
// Tinggi helaian dirender Hs = (Ww/fx)·(H/W); tinggi pembungkus Hw = fy·Hs → muka memenuhi tepat.
// `maxWidth:'none'` wajib — preflight Tailwind set img{max-width:100%}. Server-safe (tiada hook).
export interface FacePad { top?: number; right?: number; bottom?: number; left?: number }

export function DiecutFaceCrop({ url, template, face = 'top', sheet, inset = 0.02, pad, alt, className = '', loading = 'lazy' }: {
  url: string
  template: string
  face?: keyof DiecutTemplate
  /** Dimensi piksel helaian (nisbah) — null → papar helaian penuh (fallback jujur). */
  sheet: { w: number; h: number } | null
  /** Tepi dibuang (pecahan helaian) untuk sorok die-line; `pad` per sisi menimpa (boleh negatif). */
  inset?: number
  pad?: FacePad
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  const f = DIECUT_TEMPLATES[template]?.[face]
  if (!f || !sheet) {
    return (
      <div className={`overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} loading={loading} decoding="async" className="h-full w-auto object-contain" />
      </div>
    )
  }
  const x0 = f.x0 + (pad?.left ?? inset), x1 = f.x1 - (pad?.right ?? inset)
  const y0 = f.y0 + (pad?.top ?? inset), y1 = f.y1 - (pad?.bottom ?? inset)
  const fx = Math.max(0.05, x1 - x0), fy = Math.max(0.05, y1 - y0)
  const aspect = (fx * sheet.w) / (fy * sheet.h)
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: String(aspect), transform: f.rotDeg === 180 ? 'rotate(180deg)' : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading={loading}
        decoding="async"
        style={{ position: 'absolute', maxWidth: 'none', height: 'auto', width: `${100 / fx}%`, left: `${-(x0 / fx) * 100}%`, top: `${-(y0 / fy) * 100}%` }}
      />
    </div>
  )
}
