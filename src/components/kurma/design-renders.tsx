import { DESIGN_RENDERS, RENDER_NOTE } from '@/lib/gift-renders'

// Strip "Design yang kami hasilkan" — render AI daripada artwork sebenar klien (lib/gift-renders.ts).
// Menyokong manfaat #1 LP ("Tiada design? Kami reka"). Mobile: baris geser (snap); sm+: grid 4 lajur.
// Label jujur di bawah: visual render, bukan foto produk — galeri foto sebenar kekal di atas sebagai bukti.
export function DesignRenders() {
  return (
    <section className="max-w-5xl mx-auto px-4 pb-14">
      <h2 className="text-2xl font-black text-gray-900 text-center">Design yang kami hasilkan</h2>
      <p className="text-gray-500 text-center mt-1 text-sm">
        Dari artwork korporat hingga corak Ramadan — anda beri logo atau idea, kami reka.
        <span className="sm:hidden text-gray-400"> Geser untuk lihat →</span>
      </p>
      <div className="mt-6 -mx-4 px-4 flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible">
        {DESIGN_RENDERS.map(r => (
          <figure key={r.slug} className="shrink-0 w-[64vw] max-w-[250px] sm:w-auto sm:max-w-none snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.src}
              alt={`Gift box kurma — ${r.label} (visual render)`}
              width={720}
              height={900}
              loading="lazy"
              decoding="async"
              className="w-full aspect-[4/5] object-cover rounded-2xl border border-gray-100 bg-gray-50"
            />
            <figcaption className="text-[12px] font-semibold text-gray-600 mt-2 truncate">{r.label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 text-center mt-4">{RENDER_NOTE}</p>
    </section>
  )
}
