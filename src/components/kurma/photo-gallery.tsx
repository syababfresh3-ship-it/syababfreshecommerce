'use client'

// Galeri foto produk + lightbox (klik → besar, arrow/ESC). Dipakai di portfolio.
// Grid guna thumbnail ~400px (jimat bait trafik mobile); lightbox muat imej penuh.
// Dialog modal (fokus masuk/pulih, ESC/arrow, body overflow) kini dalam ./lightbox — dikongsi
// dengan grid klien LP korporat. API komponen ini tidak berubah.
import { useState, useCallback } from 'react'
import { thumbUrl } from '@/lib/gift'
import { Lightbox } from './lightbox'

export function PhotoGallery({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState<number | null>(null)

  const close = useCallback(() => setIdx(null), [])
  const prev = useCallback(() => setIdx(i => (i === null ? i : (i - 1 + photos.length) % photos.length)), [photos.length])
  const next = useCallback(() => setIdx(i => (i === null ? i : (i + 1) % photos.length)), [photos.length])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {photos.map((url, i) => (
          <button key={url} type="button" onClick={() => setIdx(i)} aria-label={`Buka gambar ${i + 1} daripada ${photos.length}`} className="rounded-xl overflow-hidden border border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition active:scale-[0.98]">
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

      {idx !== null && <Lightbox photos={photos} idx={idx} onClose={close} onPrev={prev} onNext={next} />}
    </>
  )
}
