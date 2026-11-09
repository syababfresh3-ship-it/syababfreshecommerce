import type { PosTicketDiscount, PosTicketLine, PosTotals } from '@/lib/pos/types'

// Kiraan wang POS — pure, dikongsi klien (paparan langsung) & server (sahkan semula).

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000

export const rm = (n: number) => `RM${round2(n).toFixed(2)}`

/** Pembundaran 5 sen Malaysia (tender tunai sahaja). */
export function roundCash05(total: number): { rounded: number; adj: number } {
  const rounded = round2(Math.round(total / 0.05) * 0.05)
  return { rounded, adj: round2(rounded - total) }
}

export function lineGross(line: Pick<PosTicketLine, 'qty' | 'unitPrice'>): number {
  return round2(line.qty * line.unitPrice)
}

export function lineTotal(line: Pick<PosTicketLine, 'qty' | 'unitPrice' | 'lineDiscount'>): number {
  return Math.max(0, round2(lineGross(line) - (line.lineDiscount || 0)))
}

export function cartDiscountAmount(subtotal: number, d: PosTicketDiscount | null | undefined): number {
  if (!d || !(d.value > 0)) return 0
  const amt = d.type === 'pct' ? subtotal * Math.min(d.value, 100) / 100 : d.value
  return Math.min(round2(amt), subtotal)
}

export function computeTotals(
  lines: PosTicketLine[],
  discount: PosTicketDiscount | null | undefined,
  promoDiscount: number,
  opts: { cashRounding: boolean },
): PosTotals {
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l), 0))
  const discountTotal = cartDiscountAmount(subtotal, discount)
  const promo = Math.min(round2(promoDiscount || 0), Math.max(0, subtotal - discountTotal))
  const beforeRound = Math.max(0, round2(subtotal - discountTotal - promo))
  const { rounded, adj } = opts.cashRounding ? roundCash05(beforeRound) : { rounded: beforeRound, adj: 0 }
  const weightKg = round3(lines.filter(l => l.unit === 'kg').reduce((s, l) => s + l.qty, 0))
  return { subtotal, discountTotal, promoDiscount: promo, roundingAdj: adj, total: rounded, weightKg, lineCount: lines.length }
}

/** Format kuantiti baris untuk resit/tiket: "0.750 kg" atau "2". */
export function fmtQty(qty: number, unit: 'pcs' | 'kg'): string {
  return unit === 'kg' ? `${round3(qty).toFixed(3)} kg` : String(Math.round(qty))
}
