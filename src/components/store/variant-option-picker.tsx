'use client'

// Pemilih variasi berdimensi (gaya TikTok Shop): satu baris pil untuk setiap dimensi
// (cth Saiz → Promo). Bila semua dimensi dipilih, kombinasi = satu baris
// product_variants (harga/stok sendiri) — pemanggil terima varian itu via onChange.
// Nilai tanpa kombinasi dikelabukan; kombinasi stok 0 ditanda "Habis".
// Dipakai storefront (sf-product) dan borang LP (lp-multi-checkout). Lihat lib/variant-options.ts.
import { useMemo } from 'react'
import {
  findVariant, valueAvailability, type OptionValues, type VariantOption,
} from '@/lib/variant-options'

export interface PickerVariant {
  id: string
  name: string
  price: number
  compare_price?: number | null
  stock?: number
  is_active?: boolean
  sort_order?: number
  options?: OptionValues | null
}

interface Props {
  dims: VariantOption[]
  variants: PickerVariant[]
  selection: OptionValues
  onChange: (selection: OptionValues, variant: PickerVariant | null) => void
  accent?: string       // warna pil terpilih (lalai merah jenama)
  compact?: boolean     // LP: pil lebih kecil
}

export function VariantOptionPicker({ dims, variants, selection, onChange, accent = '#E11D2A', compact = false }: Props) {
  const active = useMemo(() => variants.filter(v => v.is_active !== false), [variants])
  const lastIdx = dims.length - 1

  function pick(dimIndex: number, value: string) {
    const next: OptionValues = { ...selection, [dims[dimIndex].name]: value }
    // Dimensi lain: kalau nilai semasa tak lagi wujud dengan pilihan baharu, tukar ke nilai pertama yang ada
    for (let j = 0; j < dims.length; j++) {
      if (j === dimIndex) continue
      const avail = valueAvailability(active, dims, j, next)
      const cur = next[dims[j].name]
      if (!cur || !avail[cur]?.exists) {
        const first = dims[j].values.find(v => avail[v]?.exists)
        if (first) next[dims[j].name] = first
      }
    }
    onChange(next, findVariant(active, dims, next))
  }

  const pad = compact ? 'px-3 py-1.5 text-[12px]' : 'px-3.5 py-2 text-[13px]'

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3.5'}>
      {dims.map((dim, i) => {
        const avail = valueAvailability(active, dims, i, selection)
        const othersChosen = dims.every((d, j) => j === i || !!selection[d.name])
        return (
          <div key={dim.name}>
            <div className={`font-bold text-gray-900 mb-1.5 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
              {dim.name}
              {selection[dim.name] && <span className="font-normal text-gray-400"> · {selection[dim.name]}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {dim.values.map(val => {
                const on = selection[dim.name] === val
                const { exists, inStock } = avail[val] ?? { exists: false, inStock: false }
                // Harga pada pil dimensi terakhir bila dimensi lain dah dipilih (macam TikTok)
                const priceOf = i === lastIdx && othersChosen
                  ? findVariant(active, dims, { ...selection, [dim.name]: val })?.price
                  : undefined
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={!exists}
                    onClick={() => pick(i, val)}
                    suppressHydrationWarning
                    style={on ? { borderColor: accent, color: '#fff', background: accent } : undefined}
                    className={`relative rounded-xl border font-semibold transition active:scale-95 ${pad} ${
                      on ? '' : exists
                        ? (inStock ? 'bg-white text-gray-800 border-gray-200 hover:border-gray-400' : 'bg-white text-gray-400 border-gray-200')
                        : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                    }`}
                  >
                    <span>{val}</span>
                    {priceOf != null && (
                      <span className={`block font-black ${compact ? 'text-[10.5px]' : 'text-[11px]'} ${on ? 'text-white/85' : 'text-gray-500'}`}>
                        RM{Number(priceOf).toFixed(2)}
                      </span>
                    )}
                    {exists && !inStock && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-bold">Habis</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
