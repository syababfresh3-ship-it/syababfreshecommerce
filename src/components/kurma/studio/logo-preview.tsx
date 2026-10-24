'use client'

// Preview 2D: template <img> + kawasan logo (absolute, peratus) + <img logo> object-fit:contain
// + translate/scale. Matematik SAMA dgn composeMockup (lib/gift-mockup.ts) supaya apa yang
// dilihat = mockup yang disimpan. Kawalan: slider skala + anjak 4 arah + reset.
// Toggle 2D/3D (23 Okt 2026): bila `onViewChange` & `box3d` diberi, header ada pilihan
// paparan; mod 3D pasang `box3d` (StudioBox3D) di tempat imej — kawalan logo kekal sama.
import type { ReactNode } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import type { GiftDesign } from '@/lib/gift'
import { normalizeLogoArea, logoAreaStyle, logoImgStyle, clampTransform, DEFAULT_TRANSFORM, type LogoTransform } from '@/lib/gift-mockup'
import type { LogoAsset } from './logo-uploader'

export type PreviewView = '2d' | '3d'

export function LogoPreview({ template, logo, t, onChange, view = '2d', onViewChange, box3d }: {
  template: GiftDesign | null
  logo: LogoAsset | null
  t: LogoTransform
  onChange: (t: LogoTransform) => void
  view?: PreviewView
  onViewChange?: (v: PreviewView) => void
  box3d?: ReactNode
}) {
  const area = normalizeLogoArea(template?.logo_area)
  const canToggle = !!onViewChange && !!box3d && !!template?.image_url
  const show3d = canToggle && view === '3d'
  const nudge = (dx: number, dy: number) => onChange(clampTransform({ ...t, dx: t.dx + dx, dy: t.dy + dy }))
  const btn = 'h-9 w-9 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 active:scale-95'

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">3. Preview</p>
        {canToggle && (
          <div role="group" aria-label="Paparan preview" className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white">
            {(['2d', '3d'] as const).map(v => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => onViewChange?.(v)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition ${view === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>{v === '2d' ? '2D' : '3D kotak'}</button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 rounded-2xl border border-gray-200 bg-[#FBFAF7] p-3">
        {show3d ? box3d : template?.image_url ? (
          <div className="relative w-full overflow-hidden rounded-xl bg-white" data-testid="logo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={template.image_url} alt={template.name} className="block w-full h-auto" />
            <div className="absolute overflow-hidden" style={logoAreaStyle(area)} data-testid="logo-area">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.blobUrl} alt="Logo anda di atas template" className="w-full h-full object-contain" style={{ ...logoImgStyle(t), transformOrigin: 'center' }} data-testid="logo-img" />
              ) : (
                <div className="w-full h-full border-2 border-dashed border-gray-400/70 rounded-md grid place-items-center text-[11px] font-semibold text-gray-500 bg-white/40">Logo anda di sini</div>
              )}
            </div>
          </div>
        ) : (
          <div className="aspect-[4/3] grid place-items-center text-center px-6">
            <div>
              <p className="text-sm font-semibold text-gray-700">Pilih template dulu</p>
              <p className="text-[12px] text-gray-400 mt-1">Preview logo anda di atas kotak akan muncul di sini.</p>
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.blobUrl} alt="Logo anda" className="h-16 mx-auto mt-3 object-contain" />
              )}
            </div>
          </div>
        )}
      </div>

      {template?.image_url && logo && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-gray-600">
            Saiz
            <input type="range" min={0.5} max={1.5} step={0.05} value={t.scale} onChange={e => onChange(clampTransform({ ...t, scale: Number(e.target.value) }))} aria-label="Saiz logo" className="w-32 accent-gray-900" />
          </label>
          <div className="flex items-center gap-1" role="group" aria-label="Anjak logo">
            <button type="button" className={btn} onClick={() => nudge(-0.05, 0)} aria-label="Anjak kiri"><ArrowLeft className="h-4 w-4" /></button>
            <button type="button" className={btn} onClick={() => nudge(0.05, 0)} aria-label="Anjak kanan"><ArrowRight className="h-4 w-4" /></button>
            <button type="button" className={btn} onClick={() => nudge(0, -0.05)} aria-label="Anjak atas"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" className={btn} onClick={() => nudge(0, 0.05)} aria-label="Anjak bawah"><ArrowDown className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => onChange(DEFAULT_TRANSFORM)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-800"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">{show3d ? 'Preview 3D anggaran — seret untuk putar. Proporsi kotak & kedudukan cetakan kami sahkan sebelum cetak.' : 'Preview anggaran — kami kemaskan kedudukan & warna sebelum cetak, anda sahkan dulu.'}</p>
    </div>
  )
}
