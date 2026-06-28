"use client";

// Redesign v2 — promo carousel (home). Banner penuh-lebar (gaya Zus) + dot indicator.
import { useRef, useState } from "react";
import Link from "next/link";

const BANNERS = [
  { src: "/storev2/banner-ceri-batch5.webp", alt: "Promo Ceri Turki — Batch ke-5", href: "/products" },
  { src: "/storev2/banner-penting.webp", alt: "Penting — Penghantaran SyababFresh", href: "/products" },
];

export function SfPromo() {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(i: number) {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="space-y-2.5">
      <div ref={ref} onScroll={onScroll} className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory">
        {BANNERS.map((b) => (
          <Link
            key={b.src}
            href={b.href}
            className="snap-center shrink-0 w-full aspect-[1163/1355] rounded-2xl overflow-hidden bg-[#FDECEC] active:scale-[0.99] transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.src} alt={b.alt} className="h-full w-full object-cover" />
          </Link>
        ))}
      </div>

      {/* Dots */}
      {BANNERS.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-[#E11D2A]" : "w-1.5 bg-gray-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
