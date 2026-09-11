"use client";

// Redesign v2 — Galeri produk (Sprint 3C): swipe CSS scroll-snap + dot + thumbnail.
// Gambar pertama (image_url) dimuat segera; selebihnya lazy. Satu gambar → tiada
// dot/thumbnail. Imej WebP sedia optimum semasa upload — guna <img> biasa (tanpa
// transformasi Supabase, ikut amalan storev2).
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";

export type GalleryImage = { url: string; alt: string | null };

const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function SfProductGallery({
  images,
  name,
  children,
}: {
  images: GalleryImage[];
  name: string;
  children?: ReactNode; // overlay (badge kategori, butang wishlist) dari SfProduct
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [idx, setIdx] = useState(0);
  const many = images.length > 1;

  // Kesan slide aktif dari kedudukan scroll (dibalut rAF supaya ringan).
  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = trackRef.current;
      if (!el || el.clientWidth === 0) return;
      const next = Math.round(el.scrollLeft / el.clientWidth);
      setIdx((cur) => (cur === next ? cur : next));
    });
  }, []);

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="mx-4 sm:mx-auto sm:max-w-md">
      <div
        id="product-gallery"
        className="relative aspect-square rounded-2xl bg-gradient-to-b from-[#fdf8f2] to-[#f0e8dc] overflow-hidden"
      >
        {images.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center">
            <ImageIcon className="h-12 w-12 text-gray-300" aria-hidden />
          </div>
        ) : (
          <div
            ref={trackRef}
            onScroll={onScroll}
            className={`absolute inset-0 flex overflow-x-auto snap-x snap-mandatory ${HIDE_SCROLLBAR}`}
            aria-roledescription="karusel"
            aria-label={`Gambar ${name}`}
          >
            {images.map((im, i) => (
              <div key={im.url} className="relative h-full w-full shrink-0 snap-center snap-always">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={im.url}
                  alt={im.alt || (i === 0 ? name : `${name} — gambar ${i + 1}`)}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {children}

        {many && (
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 pointer-events-none" aria-hidden>
            {images.map((im, i) => (
              <span
                key={im.url}
                className={`h-1.5 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.5)] transition-all ${
                  i === idx ? "w-4 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {many && (
        <div className={`mt-2.5 flex gap-2 overflow-x-auto ${HIDE_SCROLLBAR}`} role="tablist" aria-label="Pilih gambar">
          {images.map((im, i) => (
            <button
              key={im.url}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Gambar ${i + 1}`}
              onClick={() => go(i)}
              className={`h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 bg-[#F4F6F5] transition ${
                i === idx ? "border-gray-900" : "border-transparent opacity-70"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
