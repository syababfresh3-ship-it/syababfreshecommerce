// SATU sumber harga Custom Gift Box Kurma — sheet harga 2026 pemilik (Syabab Trading Sdn Bhd).
// Dipakai oleh: calculator LP (papar), API enquiry (kira SEMULA di server — jangan percaya
// harga dari klien), dan admin quote tool (lajur "Harga senarai"). Pure & server-safe —
// tiada React, tiada DB. Harga per kotak TERMASUK kurma + kotak custom; TANPA penghantaran.
// Ubah angka DI SINI sahaja (dulu hardcoded dalam gift-calculator.tsx — dipindah supaya
// LP, API & admin tak bercapah).

export type SheetWeight = '100g' | '200g' | '500g'
/** minQty → RM/kotak. Tier = kuantiti minimum untuk harga itu. */
export type Tiers = Record<number, number>
export interface SheetKurma {
  id: string
  name: string
  /** Deskripsi ringkas ciri varieti (pembeli korporat selalunya tak kenal beza) — bukan dakwaan gred stok. */
  note?: string
  w: Partial<Record<SheetWeight, Tiers>>
}

export const SHEET_VERSION = '2026'
/** Berat yang ada dalam sheet. (Bukan WEIGHTS di lib/gift.ts — itu katalog lama, ada 1kg.) */
export const SHEET_WEIGHTS: readonly SheetWeight[] = ['100g', '200g', '500g']
export const QTY_PRESETS: readonly number[] = [50, 100, 200, 500, 1000, 2000]

export const KURMA: readonly SheetKurma[] = [
  { id: 'ajwa-aa', name: 'Ajwa AA', note: 'Kurma Madinah · popular untuk korporat', w: {
    '100g': { 50: 12, 100: 10, 200: 8, 500: 6, 1000: 5.5, 2000: 5 },
    '200g': { 50: 18, 100: 17, 200: 15, 500: 11, 1000: 10, 2000: 9 },
    '500g': { 500: 26, 1000: 24, 2000: 22 } } },
  { id: 'ajwa-aa-premium', name: 'Ajwa AA Premium', note: 'Ajwa gred tertinggi', w: {
    '100g': { 50: 13, 100: 12, 200: 11, 500: 7, 1000: 6.5, 2000: 6 },
    '200g': { 50: 19, 100: 18, 200: 17, 500: 12, 1000: 11, 2000: 10 },
    '500g': { 500: 27, 1000: 25, 2000: 22 } } },
  { id: 'mariami-a', name: 'Mariami A', note: 'Besar, lembut & manis', w: {
    '100g': { 50: 10, 100: 9, 200: 8, 500: 6, 1000: 5.5, 2000: 5 },
    '200g': { 50: 17, 100: 16, 200: 15, 750: 11, 1000: 9, 2000: 7 },
    '500g': { 500: 16, 1000: 14, 2000: 13 } } },
  { id: 'mariami-aa', name: 'Mariami AA', note: 'Mariami gred lebih tinggi', w: {
    '100g': { 50: 14, 100: 13, 200: 12, 500: 7, 1000: 6.5, 2000: 6 },
    '200g': { 50: 20, 100: 19, 200: 18, 500: 12, 1000: 10, 2000: 8 },
    '500g': { 500: 21, 1000: 20, 2000: 19 } } },
  { id: 'safawi-a', name: 'Safawi A', note: 'Manis pekat · paling berbaloi', w: {
    '100g': { 50: 11, 100: 10, 200: 9, 500: 5.5, 1000: 5, 2000: 4.5 },
    '200g': { 50: 16, 100: 14, 200: 12, 500: 10, 1000: 9, 2000: 8 },
    '500g': { 500: 20, 1000: 18, 2000: 16 } } },
]

export function kurmaById(id: string): SheetKurma | undefined {
  return KURMA.find(k => k.id === id)
}

export function isSheetWeight(w: unknown): w is SheetWeight {
  return typeof w === 'string' && (SHEET_WEIGHTS as readonly string[]).includes(w)
}

/** Berat isi kurma per kotak dalam gram (untuk kira kos kurma RM/kg). */
export function gramsOf(w: SheetWeight): number {
  return w === '100g' ? 100 : w === '200g' ? 200 : 500
}

export const rm = (n: number) =>
  `RM${n.toLocaleString('en-MY', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

const round2 = (n: number) => Math.round(n * 100) / 100

/** Harga/kotak untuk kuantiti ini: tier terbesar ≤ qty; kalau qty bawah tier terkecil → tier terkecil. */
export function priceFor(tiers: Tiers | undefined, qty: number): { perBox: number; minTier: number } | null {
  if (!tiers) return null
  const keys = Object.keys(tiers).map(Number).sort((a, b) => a - b)
  if (!keys.length) return null
  let tier = keys[0]
  for (const k of keys) if (qty >= k) tier = k
  return { perBox: tiers[tier], minTier: keys[0] }
}

/** Tier kuantiti terkecil untuk kombinasi kurma+berat (cth 500g bermula 500). 50 = default. */
export function minTierFor(k: SheetKurma, w: SheetWeight): number {
  const tiers = k.w[w]
  if (!tiers) return 50
  const keys = Object.keys(tiers).map(Number)
  return keys.length ? Math.min(...keys) : 50
}

/** Default ikut angle iklan (message-match): jimat → paling berbaloi + pukal; premium → Ajwa gred tertinggi. */
export function defaultsFor(angle?: string): { kurmaId: string; weight: SheetWeight; qty: number } {
  if (angle === 'jimat') return { kurmaId: 'safawi-a', weight: '100g', qty: 500 }
  if (angle === 'premium') return { kurmaId: 'ajwa-aa-premium', weight: '200g', qty: 100 }
  return { kurmaId: 'ajwa-aa', weight: '200g', qty: 100 }
}

export interface SheetSelection { kurmaId: string; weight: SheetWeight; qty: number }

export type SheetQuote =
  | {
      ok: true
      kurma: SheetKurma
      weight: SheetWeight
      /** Kuantiti yang diminta (sebelum clamp ke tier minimum). */
      requestedQty: number
      /** Kuantiti yang dikira (≥ tier minimum). */
      qty: number
      clamped: boolean
      minTier: number
      perBox: number
      total: number
    }
  | { ok: false; error: string }

/**
 * Kira semula dari sheet. Input diterima longgar (string/number dari klien atau JSON) dan
 * disahkan di sini — pemanggil server WAJIB guna ini, bukan nilai harga dari klien.
 * Matematik sama dengan calculator LP: qty = max(tier minimum, qty); total = perBox × qty.
 */
export function sheetQuote(sel: { kurmaId: unknown; weight: unknown; qty: unknown }): SheetQuote {
  const kurma = typeof sel.kurmaId === 'string' ? kurmaById(sel.kurmaId) : undefined
  if (!kurma) return { ok: false, error: 'Jenis kurma tidak sah' }
  if (!isSheetWeight(sel.weight)) return { ok: false, error: 'Berat tidak sah' }
  const weight = sel.weight
  const tiers = kurma.w[weight]
  if (!tiers) return { ok: false, error: 'Saiz ini perlu sebut harga manual — sila WhatsApp kami' }
  const requestedQty = Math.floor(Number(sel.qty))
  if (!Number.isFinite(requestedQty) || requestedQty < 1) return { ok: false, error: 'Kuantiti tidak sah' }
  const p = priceFor(tiers, requestedQty)
  if (!p) return { ok: false, error: 'Harga tidak tersedia' }
  const qty = Math.max(p.minTier, requestedQty)
  return {
    ok: true, kurma, weight, requestedQty, qty, clamped: qty !== requestedQty,
    minTier: p.minTier, perBox: p.perBox, total: round2(p.perBox * qty),
  }
}
