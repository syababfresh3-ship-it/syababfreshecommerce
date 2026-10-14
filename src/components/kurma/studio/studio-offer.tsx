// "Apa yang kami sediakan" — statik dari satu sumber: sheet (berat & jenis kurma), FINISHES,
// dan 8 foto kotak sebenar (thumbnail 400px). Tiada dakwaan baharu; semua dari data sedia ada.
import { Package, Sparkles, Layers, Truck } from 'lucide-react'
import { KURMA, SHEET_WEIGHTS, minTierFor } from '@/lib/gift-pricing'
import { FINISHES, PRODUCT_PHOTOS, thumbUrl } from '@/lib/gift'

const RED = '#E11D2A'

export function StudioOffer() {
  const photos = PRODUCT_PHOTOS.slice(0, 8)
  return (
    <section id="tawaran" className="max-w-5xl mx-auto px-4 pb-14 scroll-mt-6">
      <h2 className="text-2xl font-black text-gray-900 text-center">Apa yang kami sediakan</h2>
      <p className="text-gray-500 text-center mt-1 text-sm">Kotak custom berjenama, diisi kurma pilihan, siap dicetak & dihantar.</p>

      {/* Berat / saiz kotak */}
      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        {SHEET_WEIGHTS.map(w => {
          const minQty = Math.min(...KURMA.map(k => minTierFor(k, w)))
          return (
            <div key={w} className="rounded-2xl border border-gray-200 p-4">
              <div className="h-10 w-10 rounded-xl bg-[#FDECEC] grid place-items-center"><Package className="h-5 w-5" style={{ color: RED }} /></div>
              <div className="font-bold text-gray-900 mt-3">Kotak {w}</div>
              <div className="text-sm text-gray-500 mt-0.5">Isi kurma {w} setiap kotak · tempahan minimum {minQty} kotak</div>
            </div>
          )
        })}
      </div>

      {/* Jenis kurma */}
      <div className="rounded-2xl border border-gray-200 p-4 mt-3">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" style={{ color: RED }} /><span className="font-bold text-gray-900">Pilihan kurma</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          {KURMA.map(k => (
            <div key={k.id} className="rounded-xl bg-[#FBFAF7] border border-gray-100 px-3 py-2.5">
              <div className="text-[13px] font-bold text-gray-900 leading-tight">{k.name}</div>
              {k.note && <div className="text-[11px] text-gray-500 mt-0.5">{k.note}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Finishing + proses */}
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2"><Layers className="h-4 w-4" style={{ color: RED }} /><span className="font-bold text-gray-900">Finishing</span></div>
          <div className="flex flex-wrap gap-2 mt-3">
            {FINISHES.map(f => <span key={f.code} className="text-[12px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">{f.label}</span>)}
          </div>
          <p className="text-[12px] text-gray-500 mt-3">Design percuma — hantar logo/rujukan, kami reka & anda sahkan sebelum cetak.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2"><Truck className="h-4 w-4" style={{ color: RED }} /><span className="font-bold text-gray-900">Proses</span></div>
          <ol className="text-sm text-gray-600 mt-3 space-y-1.5 list-decimal list-inside">
            <li>Pilih template / upload design & kira harga di bawah</li>
            <li>Hantar enquiry → kami sahkan harga & design di WhatsApp</li>
            <li>Deposit → cetak & isi kurma (lead time ~2 minggu) → hantar</li>
          </ol>
        </div>
      </div>

      {/* Foto kotak sebenar */}
      {photos.length > 0 && (
        <div className="mt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {photos.map((url, i) => (
              <div key={url} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(url)} alt={`Gift box kurma ${i + 1}`} loading="lazy" decoding="async" className="w-full aspect-[4/3] object-cover" />
              </div>
            ))}
          </div>
          <p className="text-center text-[12px] text-gray-400 mt-2">Antara kotak yang kami hasilkan untuk korporat & agensi.</p>
        </div>
      )}
    </section>
  )
}
