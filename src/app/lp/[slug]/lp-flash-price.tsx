'use client'

// Harga produk LP yang sedar tawaran masa terhad (gaya TikTok: harga asal dicoret, harga potongan menonjol).
// Dipakai pada kad {{product:slug}} (konteks 1 unit). JUJUR: diskaun kita per PESANAN (RM5 sekali) —
// untuk 1 unit, "~~RM89~~ RM84" tepat; jumlah sebenar pada kuantiti lain sentiasa dipapar di checkout.
// Tiada tawaran aktif → paparan asal (harga + compare_price dicoret) tak berubah.
import { useFlashDiscount } from '@/lib/stores/lp-flash'

export function LpFlashPrice({ price, compare, qty = 1 }: { price: number; compare?: number | null; qty?: number }) {
  const amount = price * Math.max(1, qty)
  const { active, final } = useFlashDiscount(amount)
  if (!active) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xl font-black" style={{ color: 'var(--cherry, #9C0F30)' }}>RM{amount.toFixed(2)}</span>
        {compare != null && Number(compare) > price && (
          <span className="text-sm text-gray-400 line-through">RM{(Number(compare) * Math.max(1, qty)).toFixed(2)}</span>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      <span className="text-xl font-black text-[#E11D2A]">RM{final.toFixed(2)}</span>
      <span className="text-sm text-gray-400 line-through">RM{amount.toFixed(2)}</span>
      <span className="text-[10px] font-extrabold uppercase tracking-wide bg-[#FDECEC] text-[#E11D2A] rounded-full px-2 py-0.5">Tawaran masa terhad</span>
    </div>
  )
}
