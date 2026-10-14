'use client'

// Galeri foto produk + lightbox (klik → besar, arrow/ESC). Dipakai di portfolio.
// Grid guna thumbnail ~400px (jimat bait trafik mobile); lightbox muat imej penuh.
// Lightbox = dialog modal betul: role/aria-modal, fokus masuk ke butang Tutup bila dibuka,
// fokus dipulihkan ke thumbnail asal bila ditutup (sebelum ni fokus tertinggal di belakang overlay).
import { useState, useCallback, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { thumbUrl } from '@/lib/gift'

export function PhotoGallery({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState<number | null>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  const open = useCallback((i: number) => {
    restoreTo.current = document.activeElement as HTMLElement | null
    setIdx(i)
  }, [])
  const close = useCallback(() => setIdx(null), [])
  const prev = useCallback(() => setIdx(i => (i === null ? i : (i - 1 + photos.length) % photos.length)), [photos.length])
  const next = useCallback(() => setIdx(i => (i === null ? i : (i + 1) % photos.length)), [photos.length])

  useEffect(() => {
    if (idx === null) {
      // Ditutup → pulangkan fokus ke thumbnail yang dibuka tadi
      restoreTo.current?.focus?.()
      restoreTo.current = null
      return
    }
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [idx, close, prev, next])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {photos.map((url, i) => (
          <button key={url} type="button" onClick={() => open(i)} aria-label={`Buka gambar ${i + 1} daripada ${photos.length}`} className="rounded-xl overflow-hidden border border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition active:scale-[0.98]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbUrl(url)}
              alt={`Gift box kurma ${i + 1}`}
              loading="lazy"
              decoding="async"
              // Thumbnail tiada (upload gagal/baru) → jatuh balik ke imej penuh, bukan kotak kosong
              onError={e => { const t = e.currentTarget; if (t.src !== url) t.src = url }}
              className="w-full aspect-[4/3] object-cover"
            />
          </button>
        ))}
      </div>

      {idx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Gambar ${idx + 1} daripada ${photos.length}`}
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 select-none"
          onClick={close}
        >
          <button ref={closeBtn} type="button" onClick={close} className="absolute top-3 right-3 text-white/80 hover:text-white p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Tutup"><X className="h-6 w-6" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); prev() }} className="absolute left-1 sm:left-6 text-white/60 hover:text-white p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Sebelum"><ChevronLeft className="h-9 w-9" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[idx]} alt={`Gift box kurma ${idx + 1}`} className="max-h-[86vh] max-w-full rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={(e) => { e.stopPropagation(); next() }} className="absolute right-1 sm:right-6 text-white/60 hover:text-white p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Seterusnya"><ChevronRight className="h-9 w-9" /></button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs font-medium tabular-nums" aria-live="polite">{idx + 1} / {photos.length}</span>
        </div>
      )}
    </>
  )
}
