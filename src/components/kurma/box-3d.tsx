'use client'

// Preview 3D kotak gift — bungkus <model-viewer> (Google). Muat modul dari CDN
// sekali sahaja (tiada dependency npm). Tiada model .glb → papar gambar.
import { createElement, useEffect, useState } from 'react'

const MV_SRC = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js'
let injected = false

function ensureModelViewer() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const s = document.createElement('script')
  s.type = 'module'; s.src = MV_SRC
  document.head.appendChild(s)
}

export function Box3D({ modelUrl, imageUrl, alt = 'Gift box' }: { modelUrl?: string | null; imageUrl?: string | null; alt?: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { ensureModelViewer(); const t = setTimeout(() => setReady(true), 50); return () => clearTimeout(t) }, [])

  if (!modelUrl) {
    return (
      <div className="aspect-square w-full rounded-2xl bg-[#F4F6F5] overflow-hidden grid place-items-center">
        {imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={imageUrl} alt={alt} className="h-full w-full object-contain" />
          : <span className="text-sm text-gray-400">No preview</span>}
      </div>
    )
  }

  // createElement elak isu typing custom element dalam JSX
  return (
    <div className="aspect-square w-full rounded-2xl bg-[#F4F6F5] overflow-hidden">
      {ready && createElement('model-viewer', {
        src: modelUrl,
        poster: imageUrl ?? undefined,
        alt,
        'camera-controls': true,
        'auto-rotate': true,
        // Sudut awal condong ke bawah supaya reka bentuk atas tutup nampak jelas.
        'camera-orbit': '25deg 58deg auto',
        // Seret bebas atas/bawah (15deg..165deg). touch-action none supaya seret
        // menegak di telefon PUTAR kotak (bukan skrol) — fix "tak boleh ke atas/bawah".
        'min-camera-orbit': 'auto 15deg auto',
        'max-camera-orbit': 'auto 165deg auto',
        'interaction-prompt': 'none',
        // tone-mapping neutral + exposure rendah sikit — elak render terlalu cerah/silau.
        'tone-mapping': 'neutral',
        exposure: '0.9',
        'shadow-intensity': '0.8',
        'touch-action': 'none',
        style: { width: '100%', height: '100%', backgroundColor: '#F4F6F5' },
      })}
    </div>
  )
}
