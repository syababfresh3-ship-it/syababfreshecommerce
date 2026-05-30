// Pengiraan refund — generik untuk semua produk. Dikongsi antara borang (live
// preview) dan API (validasi + simpan) supaya jumlah sentiasa konsisten.

export type RefundCalcMethod = 'per_unit' | 'percentage'
export type RefundPaymentMethod = 'transfer' | 'baucar' | 'ganti_produk'
export type RefundStatus = 'pending' | 'processing' | 'selesai'

export interface RefundItemInput {
  unit_price: number | string
  quantity: number | string
  calc_method: RefundCalcMethod
  rosak_qty?: number | string | null
  percent_rosak?: number | string | null
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '')
  return Number.isFinite(n) ? n : 0
}

// Refund untuk satu line item:
//   per_unit   → unit_price × rosak_qty
//   percentage → (unit_price × quantity) × percent_rosak / 100
export function calcItemRefund(item: RefundItemInput): number {
  const unit = num(item.unit_price)
  if (item.calc_method === 'percentage') {
    const subtotal = unit * num(item.quantity)
    const pct = Math.min(Math.max(num(item.percent_rosak), 0), 100)
    return round2(subtotal * (pct / 100))
  }
  // per_unit — had rosak_qty tak melebihi quantity yang dipesan
  const rosak = Math.min(num(item.rosak_qty), num(item.quantity))
  return round2(unit * Math.max(rosak, 0))
}

export function calcRefundTotal(items: RefundItemInput[]): number {
  return round2(items.reduce((sum, it) => sum + calcItemRefund(it), 0))
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const PAYMENT_LABELS: Record<RefundPaymentMethod, string> = {
  transfer: 'Transfer Bank',
  baucar: 'Baucar / Kredit Points',
  ganti_produk: 'Ganti Produk',
}

export const STATUS_LABELS: Record<RefundStatus, string> = {
  pending: 'Pending',
  processing: 'Dalam Proses',
  selesai: 'Selesai',
}
