import { DiecutFaceCrop } from '@/components/kurma/diecut-face-crop'
import { featuredArtwork } from '@/lib/gift-clients'

// Strip artwork — organisasi yang kami ada artwork die-cut tapi tiada foto kotak siap. Dilabel
// jujur ("artwork") — bukan foto. Crop muka atas (DiecutFaceCrop); baris skrol mendatar kerana
// nisbah muka berbeza (1.5–2.2) — grid akan nampak compang.
export function ArtworkStrip() {
  const list = featuredArtwork().slice(0, 10)
  if (!list.length) return null
  return (
    <section className="max-w-5xl mx-auto px-4 pb-14">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">Design yang kami hasilkan untuk…</h2>
          <p className="text-[12px] text-gray-400">Artwork die-cut sebenar yang kami cetak — muka atas kotak</p>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 shrink-0">Artwork</span>
      </div>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 [scrollbar-width:thin]">
        {list.map(({ a, d }) => (
          <figure key={`${a.designName}-${a.size}`} className="m-0 shrink-0 snap-start">
            <div className="h-24 sm:h-32 rounded-xl border border-gray-200 bg-[#FBFAF7] overflow-hidden">
              <DiecutFaceCrop url={d.url} template={d.template} face={a.face} sheet={a.sheet} pad={a.pad} alt={`Artwork kotak ${a.client}`} className="h-full" />
            </div>
            <figcaption className="text-[12px] font-semibold text-gray-700 mt-1.5">{a.client}<span className="text-gray-400 font-normal"> · {a.size}</span></figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
