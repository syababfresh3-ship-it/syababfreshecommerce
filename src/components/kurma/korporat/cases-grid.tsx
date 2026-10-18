'use client'

// Grid "Kerja kami" — foto kotak SEBENAR + nama klien. Klik → lightbox semua foto (kapsyen klien).
// Thumbnail 400px (thumbUrl) + onError → imej penuh (corak photo-gallery).
import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { thumbUrl } from '@/lib/gift'
import { Lightbox } from '@/components/kurma/lightbox'
import { kurmaPath } from '@/lib/kurma-host'

export interface CaseItem { client: string; sector?: string; photos: string[] }

export function CasesGrid({ items, totalPhotos }: { items: CaseItem[]; totalPhotos: number }) {
  // Senarai rata untuk lightbox: semua foto semua klien, kapsyen = nama klien; kad buka pada foto hero.
  const flat = useMemo(() => {
    const photos: string[] = []; const captions: string[] = []; const start: number[] = []
    for (const it of items) { start.push(photos.length); for (const p of it.photos) { photos.push(p); captions.push(it.client) } }
    return { photos, captions, start }
  }, [items])
  const [idx, setIdx] = useState<number | null>(null)
  const close = useCallback(() => setIdx(null), [])
  const prev = useCallback(() => setIdx(i => (i === null ? i : (i - 1 + flat.photos.length) % flat.photos.length)), [flat.photos.length])
  const next = useCallback(() => setIdx(i => (i === null ? i : (i + 1) % flat.photos.length)), [flat.photos.length])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((it, i) => {
          const hero = it.photos[0]
          return (
            <button
              key={it.client}
              type="button"
              onClick={() => setIdx(flat.start[i])}
              aria-label={`Lihat kotak untuk ${it.client}`}
              className="text-left rounded-2xl overflow-hidden border border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbUrl(hero)}
                alt={`Gift box kurma untuk ${it.client}`}
                loading="lazy"
                decoding="async"
                onError={e => { const t = e.currentTarget; if (t.src !== hero) t.src = hero }}
                className="w-full aspect-square object-cover bg-[#FBFAF7]"
              />
              <div className="px-3 py-2.5">
                <div className="text-[13px] font-bold text-gray-900 leading-snug">{it.client}</div>
                {it.sector && <div className="text-[11px] text-gray-400 mt-0.5">{it.sector}</div>}
                {it.photos.length > 1 && <div className="text-[11px] text-gray-400 mt-0.5">{it.photos.length} foto</div>}
              </div>
            </button>
          )
        })}
      </div>
      <div className="text-center mt-5">
        <Link href={kurmaPath('/portfolio')} className="text-sm font-semibold text-gray-500 hover:text-gray-800 underline underline-offset-4">Lihat semua {totalPhotos} foto di portfolio →</Link>
      </div>
      {idx !== null && <Lightbox photos={flat.photos} captions={flat.captions} idx={idx} onClose={close} onPrev={prev} onNext={next} />}
    </>
  )
}
