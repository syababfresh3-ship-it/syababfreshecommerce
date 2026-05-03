'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  images: string[]
  name: string
  discount: number | null
}

export function ImageGallery({ images, name, discount }: Props) {
  const [idx, setIdx] = useState(0)

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gradient-to-b from-[#fdf8f2] to-[#f0e8dc] relative overflow-hidden flex items-center justify-center text-8xl">
        🛒
      </div>
    )
  }

  const prev = () => setIdx(i => (i - 1 + images.length) % images.length)
  const next = () => setIdx(i => (i + 1) % images.length)

  return (
    <div className="aspect-square bg-gradient-to-b from-[#fdf8f2] to-[#f0e8dc] relative overflow-hidden select-none">
      {images.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-300 ${i === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Image
            src={src}
            alt={`${name} — gambar ${i + 1}`}
            fill
            className="object-cover scale-[1.06]"
            sizes="(max-width: 768px) 100vw, 500px"
            priority={i === 0}
          />
        </div>
      ))}

      {/* depth gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />

      {discount && (
        <span className="absolute top-4 left-4 bg-red-500 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-[0_2px_10px_rgba(239,68,68,0.45)] z-10">
          -{discount}%
        </span>
      )}

      {/* Prev / Next arrows — only if multiple images */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-md text-gray-700 hover:bg-white transition-colors"
            aria-label="Gambar sebelum"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-md text-gray-700 hover:bg-white transition-colors"
            aria-label="Gambar seterusnya"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${i === idx ? 'bg-white w-4 h-2' : 'bg-white/50 w-2 h-2'}`}
                aria-label={`Gambar ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
