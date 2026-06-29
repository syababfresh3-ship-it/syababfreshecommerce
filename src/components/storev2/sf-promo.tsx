"use client";

// Redesign v2 — promo carousel (home). Baca dari jadual `banners` (uruskan di /admin/banners).
import { useRef, useState } from "react";
import Link from "next/link";

export type SfBanner = {
  id: string;
  image_url: string | null;
  title: string;
  subtitle: string | null;
  link: string | null;
  link_label: string | null;
  bg_class: string | null;
};

export function SfPromo({ banners }: { banners: SfBanner[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  if (!banners || banners.length === 0) return null;

  function onScroll() {
    const el = ref.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }
  function goTo(i: number) {
    const el = ref.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  const cls = "snap-center shrink-0 w-full aspect-[1163/1355] rounded-2xl overflow-hidden bg-[#FDECEC] active:scale-[0.99] transition";

  return (
    <div className="space-y-2.5">
      <div ref={ref} onScroll={onScroll} className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory">
        {banners.map((b) => {
          const inner = b.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.image_url} alt={b.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full p-5 flex flex-col justify-end text-white" style={{ background: "linear-gradient(135deg,#E11D2A,#A01018)" }}>
              <p className="text-[22px] font-extrabold leading-tight">{b.title}</p>
              {b.subtitle && <p className="text-[13px] text-white/85 mt-1">{b.subtitle}</p>}
              {b.link_label && (
                <span className="self-start mt-3 bg-white text-[#E11D2A] rounded-full px-4 py-1.5 text-[12px] font-bold">{b.link_label}</span>
              )}
            </div>
          );
          return b.link ? (
            <Link key={b.id} href={b.link} className={cls}>{inner}</Link>
          ) : (
            <div key={b.id} className={cls}>{inner}</div>
          );
        })}
      </div>

      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {banners.map((_, i) => (
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
