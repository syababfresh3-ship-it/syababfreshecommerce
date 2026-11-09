import type { PosSettings } from '@/lib/pos/types'

// Tetapan POS — SATU kunci app_settings `pos_settings` (JSON). app_settings boleh dibaca umum
// → JANGAN simpan rahsia di sini. Corak sama dengan lib/borong-settings.ts.

export const POS_SETTINGS_KEY = 'pos_settings'

export const DEFAULT_POS_SETTINGS: PosSettings = {
  receiptHeader: null,
  receiptFooter: 'Thank you. Please keep this receipt for any enquiries.',
  duitnowQrUrl: null,
  paperWidth: 80,
  defaultFloat: 200,
  cashierMaxDiscountPct: 10,
  waReceiptMode: 'link',
  openWeightAll: false,
  requireShift: true,
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s || null
}
const num = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function normalizePosSettings(input: unknown): PosSettings {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const qr = str(o.duitnowQrUrl, 400_000)
  return {
    receiptHeader: str(o.receiptHeader, 300),
    // kunci tiada (JSON lama / ditulis separa) → footer lalai; admin kosongkan sengaja ('') → null
    receiptFooter: 'receiptFooter' in o ? str(o.receiptFooter, 300) : DEFAULT_POS_SETTINGS.receiptFooter,
    // data URL imej (PNG/JPEG/WebP) atau URL https sahaja
    duitnowQrUrl: qr && (/^data:image\/(png|jpeg|webp);base64,/.test(qr) || /^https:\/\//.test(qr)) ? qr : null,
    paperWidth: Number(o.paperWidth) === 58 ? 58 : 80,
    defaultFloat: num(o.defaultFloat, 0, 100_000, DEFAULT_POS_SETTINGS.defaultFloat),
    cashierMaxDiscountPct: num(o.cashierMaxDiscountPct, 0, 100, DEFAULT_POS_SETTINGS.cashierMaxDiscountPct),
    waReceiptMode: o.waReceiptMode === 'murpati' ? 'murpati' : 'link',
    openWeightAll: o.openWeightAll === true || o.openWeightAll === 'true',
    // kunci tiada (JSON lama) → hidup; hanya false eksplisit mematikan
    requireShift: !(o.requireShift === false || o.requireShift === 'false'),
  }
}

/** Toleran JSON rosak / kunci tiada → lalai. */
export function parsePosSettings(raw: string | null | undefined): PosSettings {
  if (!raw) return DEFAULT_POS_SETTINGS
  try { return normalizePosSettings(JSON.parse(raw)) } catch { return DEFAULT_POS_SETTINGS }
}
