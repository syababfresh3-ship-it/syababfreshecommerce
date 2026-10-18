'use client'

// Lightbox dialog modal (ESC/arrow, fokus masuk ke Tutup, fokus dipulihkan ke pencetus bila ditutup).
// Diekstrak dari photo-gallery.tsx supaya dikongsi grid klien LP korporat (dengan kapsyen).
import { useCallback, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export function Lightbox({ photos, idx, captions, onClose, onPrev, onNext }: {
  photos: string[]
  idx: number
  captions?: (string | undefined)[]
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const closeBtn = useRef<HTMLButtonElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  // Mount = dibuka: simpan elemen aktif (thumbnail), fokus ke Tutup; unmount = pulangkan fokus.
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null
    closeBtn.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      restoreTo.current?.focus?.()
      restoreTo.current = null
    }
  }, [])

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowLeft') onPrev()
    else if (e.key === 'ArrowRight') onNext()
  }, [onClose, onPrev, onNext])
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  const caption = captions?.[idx]
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Gambar ${idx + 1} daripada ${photos.length}${caption ? ` — ${caption}` : ''}`}
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <button ref={closeBtn} type="button" onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Tutup"><X className="h-6 w-6" /></button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onPrev() }} className="absolute left-1 sm:left-6 text-white/60 hover:text-white p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Sebelum"><ChevronLeft className="h-9 w-9" /></button>
      <figure className="m-0 max-w-full" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[idx]} alt={caption ?? `Gift box kurma ${idx + 1}`} className="max-h-[82vh] max-w-full rounded-lg object-contain shadow-2xl" />
        {caption && <figcaption className="text-center text-white/90 text-sm font-semibold mt-3">{caption}</figcaption>}
      </figure>
      <button type="button" onClick={(e) => { e.stopPropagation(); onNext() }} className="absolute right-1 sm:right-6 text-white/60 hover:text-white p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Seterusnya"><ChevronRight className="h-9 w-9" /></button>
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs font-medium tabular-nums" aria-live="polite">{idx + 1} / {photos.length}</span>
    </div>
  )
}
