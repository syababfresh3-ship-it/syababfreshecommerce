import { SELLER } from '@/lib/seller'
import { posAbs } from '@/lib/pos/host'
import { fmtQty, rm } from '@/lib/pos/money'
import { POS_PAY_LABEL, type PosSaleDetail, type PosSettings } from '@/lib/pos/types'

// Teks e-resit untuk WhatsApp (Bahasa Inggeris, tanpa emoji — keputusan pemilik 9 Nov) + URL resit awam.

export const receiptUrl = (token: string) => posAbs(`/pos/resit/${token}`)

export function fmtKl(iso: string): string {
  return new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

export function buildReceiptText(d: PosSaleDetail, settings: PosSettings): string {
  const { sale, items, payments } = d
  const lines: string[] = []
  lines.push(`${SELLER.brand} — Receipt`)
  lines.push(`No: ${sale.receipt_no ?? sale.local_ref ?? '-'}`)
  lines.push(`Date: ${fmtKl(sale.sold_at)}`)
  lines.push('')
  for (const it of items) {
    const name = it.variant_name && it.variant_name !== 'ikut berat' ? `${it.name} ${it.variant_name}` : it.name
    const qty = it.unit === 'kg' ? `${fmtQty(Number(it.qty), 'kg')} x ${rm(Number(it.unit_price))}/kg` : `${fmtQty(Number(it.qty), 'pcs')} x ${rm(Number(it.unit_price))}`
    lines.push(`${name}`)
    lines.push(`  ${qty} = ${rm(Number(it.line_total))}${Number(it.line_discount) > 0 ? ` (discount ${rm(Number(it.line_discount))})` : ''}`)
  }
  lines.push('')
  if (Number(sale.discount_total) > 0) lines.push(`Discount: -${rm(Number(sale.discount_total))}`)
  if (Number(sale.promo_discount) > 0) lines.push(`Promo ${sale.promo_code ?? ''}: -${rm(Number(sale.promo_discount))}`)
  if (Number(sale.rounding_adj) !== 0) lines.push(`Rounding: ${Number(sale.rounding_adj) > 0 ? '+' : ''}${rm(Number(sale.rounding_adj))}`)
  lines.push(`TOTAL: ${rm(Number(sale.total))}`)
  for (const p of payments.filter(p => p.status === 'paid')) {
    const extra = p.method === 'cash' && p.tendered != null ? ` (cash ${rm(Number(p.tendered))}, change ${rm(Number(p.change_given ?? 0))})` : p.ref ? ` (ref ${p.ref})` : ''
    lines.push(`Paid by ${POS_PAY_LABEL[p.method]}: ${rm(Number(p.amount))}${extra}`)
  }
  if (sale.status === 'void') lines.push('** RECEIPT VOIDED **')
  lines.push('')
  lines.push(`Full receipt: ${receiptUrl(sale.public_token)}`)
  if (settings.receiptFooter) lines.push(settings.receiptFooter)
  return lines.join('\n')
}

/** Pautan wa.me pra-isi — dibuka di peranti kasyer; tiada API, tiada risiko ban. */
export function waReceiptLink(phoneNorm: string | null, text: string): string {
  const base = phoneNorm ? `https://wa.me/${phoneNorm}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(text)}`
}
