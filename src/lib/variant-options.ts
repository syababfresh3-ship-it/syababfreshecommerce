// ============================================================
// variant-options — variasi berdimensi gaya TikTok Shop (migration 136).
//
// Setiap KOMBINASI kekal satu baris product_variants (harga/stok/berat sendiri) —
// itu yang troli, order, WA, export ops dan stok faham. Lapisan ini hanya
// menerangkan bagaimana baris-baris itu disusun mengikut dimensi, cth:
//
//   products.variant_options = [
//     { name: 'Saiz',  values: ['Small (150g+)', 'Large (300g+)'] },
//     { name: 'Promo', values: ['1 biji', '2 biji + FREE 2 biji', ...] },
//   ]
//   product_variants.options = { Saiz: 'Large (300g+)', Promo: '2 biji + FREE 2 biji' }
//
// Produk tanpa variant_options (atau varian tanpa options) → senarai rata seperti dulu.
// Fungsi tulen (tiada React/DB) — dipakai pemilih storefront/LP, admin dan API penjana.
// ============================================================

export interface VariantOption { name: string; values: string[] }
export type OptionValues = Record<string, string>

export const MAX_DIMENSIONS = 3
export const MAX_VALUES_PER_DIMENSION = 30
export const COMBO_SEPARATOR = ' · '

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()

/** Sahkan & bersihkan senarai dimensi dari JSON/DB. Dimensi/nilai kosong atau berulang dibuang. */
export function parseVariantOptions(raw: unknown): VariantOption[] {
  let arr: unknown = raw
  if (typeof raw === 'string') { try { arr = JSON.parse(raw) } catch { return [] } }
  if (!Array.isArray(arr)) return []
  const out: VariantOption[] = []
  const seen = new Set<string>()
  for (const d of arr) {
    const name = clean((d as VariantOption)?.name)
    if (!name || seen.has(name.toLowerCase())) continue
    const values: string[] = []
    const seenV = new Set<string>()
    for (const v of ((d as VariantOption)?.values ?? [])) {
      const val = clean(v)
      if (!val || seenV.has(val.toLowerCase())) continue
      seenV.add(val.toLowerCase()); values.push(val)
      if (values.length >= MAX_VALUES_PER_DIMENSION) break
    }
    if (values.length === 0) continue
    seen.add(name.toLowerCase()); out.push({ name, values })
    if (out.length >= MAX_DIMENSIONS) break
  }
  return out
}

/** Produk ini guna dimensi? (ada dimensi DAN sekurang-kurangnya satu varian aktif ada options) */
export function usesDimensions(dims: VariantOption[], variants: { options?: OptionValues | null; is_active?: boolean }[]): boolean {
  return dims.length > 0 && variants.some(v => v.is_active !== false && v.options && Object.keys(v.options).length > 0)
}

/** Nama kanonik kombinasi — ikut tertib dimensi: "Large (300g+) · 2 biji + FREE 2 biji". */
export function comboName(values: OptionValues, dims: VariantOption[]): string {
  return dims.map(d => values[d.name]).filter(Boolean).join(COMBO_SEPARATOR)
}

/** Semua kombinasi ikut tertib (dimensi pertama paling luar). */
export function generateCombos(dims: VariantOption[]): OptionValues[] {
  if (dims.length === 0) return []
  let combos: OptionValues[] = [{}]
  for (const d of dims) {
    const next: OptionValues[] = []
    for (const c of combos) for (const v of d.values) next.push({ ...c, [d.name]: v })
    combos = next
  }
  return combos
}

/** Adakah options varian sepadan sepenuhnya dengan pilihan (untuk semua dimensi)? */
export function matchesSelection(options: OptionValues | null | undefined, selection: OptionValues, dims: VariantOption[]): boolean {
  if (!options) return false
  return dims.every(d => options[d.name] === selection[d.name])
}

/** Varian yang sepadan dengan pilihan lengkap; null kalau belum lengkap / tiada. */
export function findVariant<V extends { options?: OptionValues | null; is_active?: boolean }>(
  variants: V[], dims: VariantOption[], selection: OptionValues,
): V | null {
  if (dims.some(d => !selection[d.name])) return null
  return variants.find(v => v.is_active !== false && matchesSelection(v.options, selection, dims)) ?? null
}

/**
 * Untuk dimensi ke-i: nilai mana yang masih "boleh" berdasarkan pilihan dimensi LAIN.
 * Pulangkan peta nilai → { exists, inStock }. exists=false → tiada kombinasi (kelabu/garis);
 * inStock=false → ada kombinasi tapi stok 0 (tunjuk "Habis").
 */
export function valueAvailability<V extends { options?: OptionValues | null; is_active?: boolean; stock?: number }>(
  variants: V[], dims: VariantOption[], dimIndex: number, selection: OptionValues,
): Record<string, { exists: boolean; inStock: boolean }> {
  const dim = dims[dimIndex]
  const out: Record<string, { exists: boolean; inStock: boolean }> = {}
  for (const val of dim.values) {
    const candidates = variants.filter(v =>
      v.is_active !== false && v.options && v.options[dim.name] === val &&
      dims.every((d, j) => j === dimIndex || !selection[d.name] || v.options![d.name] === selection[d.name]),
    )
    out[val] = { exists: candidates.length > 0, inStock: candidates.some(v => v.stock === undefined || v.stock === null || v.stock > 0) }
  }
  return out
}

/** Pilihan lalai: kombinasi varian aktif pertama (ikut sort_order) — supaya harga terus nampak. */
export function defaultSelection<V extends { options?: OptionValues | null; is_active?: boolean; sort_order?: number }>(
  variants: V[], dims: VariantOption[],
): OptionValues {
  const first = [...variants]
    .filter(v => v.is_active !== false && v.options)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
  if (!first?.options) return {}
  const sel: OptionValues = {}
  for (const d of dims) if (first.options[d.name]) sel[d.name] = first.options[d.name]
  return sel
}
