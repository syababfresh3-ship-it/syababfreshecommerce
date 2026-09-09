import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/murpati'
import { sendAdminPush } from '@/lib/push'

// ============================================================
// Stok — satu laluan untuk potong & pulang (storefront `orders` dan
// LP/tetamu `lp_guest_orders`). Audit §0.7: dulu order LP/tetamu tak pernah
// potong stok; audit §4: cancel admin tak pulangkan stok.
//
// Potong  : rpc deduct_variant_stock / deduct_inventory (sedia ada, FIFO batch)
// Pulang  : rpc restore_stock (migration 123, service role sahaja)
// Sekali sahaja: tuntutan atomik pada stock_deducted_at / stock_restored_at.
// Tahan-ralat: kalau lajur/fungsi migration 123 belum wujud → 'skipped'
// (tingkah laku lama), tak pernah gagalkan order.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export interface StockItem {
  product_id: string
  variant_id?: string | null
  quantity: number
  product_name?: string | null
}

const MISSING = new Set(['42703', '42883', 'PGRST202', 'PGRST204'])  // lajur / fungsi belum wujud

export async function deductItems(sb: SB, items: StockItem[]): Promise<{ oversold: StockItem[] }> {
  const results = await Promise.all(items.map(it =>
    it.variant_id
      ? sb.rpc('deduct_variant_stock', { p_variant_id: it.variant_id, p_quantity: it.quantity })
      : sb.rpc('deduct_inventory', { p_product_id: it.product_id, p_quantity: it.quantity }),
  ))
  return { oversold: items.filter((_, i) => results[i].error) }
}

export async function restoreItems(sb: SB, items: StockItem[]): Promise<void> {
  for (const it of items) {
    if (!it.quantity || it.quantity <= 0) continue
    const { error } = await sb.rpc('restore_stock', {
      p_product_id: it.product_id, p_variant_id: it.variant_id ?? null, p_quantity: it.quantity,
    })
    if (error && !MISSING.has(error.code ?? '')) console.error('[stock] restore gagal', it.product_id, error.message)
  }
}

function notifyAdminOversold(orderNumber: string, total: number, name: string, phone: string, oversold: StockItem[]) {
  const names = oversold.map(i => i.product_name ?? i.product_id).join(', ')
  const adminPhone = process.env.ADMIN_WHATSAPP
  if (adminPhone) {
    sendWhatsApp(adminPhone, [
      `STOK TIDAK MENCUKUPI — tindakan diperlukan`,
      ``,
      `Order *${orderNumber}* (RM${total.toFixed(2)}) tetapi stok tidak cukup untuk: ${names}.`,
      `Pelanggan: *${name}* (${phone}). Sila hubungi untuk maklumkan kelewatan / penggantian.`,
    ].join('\n')).catch(() => {})
  }
  sendAdminPush({ title: `Stok tidak cukup: ${orderNumber}`, body: names.slice(0, 120), url: '/admin/orders', tag: 'oversold' }).catch(() => {})
}

// ── LP / tetamu ─────────────────────────────────────────────

export async function deductLpOrderStock(sb: SB, lpOrderId: string): Promise<'deducted' | 'oversold' | 'already' | 'skipped'> {
  const { data: rows, error } = await sb
    .from('lp_guest_orders')
    .update({ stock_deducted_at: new Date().toISOString() })
    .eq('id', lpOrderId)
    .is('stock_deducted_at', null)
    .select('id, order_number, name, phone, total, items, shipment_notes')
  if (error) {
    if (!MISSING.has(error.code ?? '')) console.error('[stock] lp claim gagal', error.message)
    return 'skipped'
  }
  const row = rows?.[0]
  if (!row) return 'already'

  const items = ((row.items as StockItem[] | null) ?? []).filter(i => i?.product_id && i.quantity > 0)
  if (items.length === 0) return 'deducted'

  const { oversold } = await deductItems(sb, items)
  if (oversold.length === 0) return 'deducted'

  const note = `STOK TIDAK MENCUKUPI: ${oversold.map(i => i.product_name ?? i.product_id).join(', ')}`
  await sb.from('lp_guest_orders')
    .update({ shipment_notes: row.shipment_notes ? `${row.shipment_notes}\n${note}` : note })
    .eq('id', lpOrderId)
  notifyAdminOversold(row.order_number, Number(row.total), row.name, row.phone, oversold)
  return 'oversold'
}

export async function restoreLpOrderStock(sb: SB, lpOrderId: string): Promise<'restored' | 'nothing' | 'skipped'> {
  const { data: rows, error } = await sb
    .from('lp_guest_orders')
    .update({ stock_restored_at: new Date().toISOString() })
    .eq('id', lpOrderId)
    .not('stock_deducted_at', 'is', null)
    .is('stock_restored_at', null)
    .select('id, items')
  if (error) {
    if (!MISSING.has(error.code ?? '')) console.error('[stock] lp restore claim gagal', error.message)
    return 'skipped'
  }
  const row = rows?.[0]
  if (!row) return 'nothing'
  await restoreItems(sb, ((row.items as StockItem[] | null) ?? []).filter(i => i?.product_id))
  return 'restored'
}

// ── Storefront `orders` ─────────────────────────────────────
// Stok dipotong masa bayaran disahkan (confirmStorefrontOrder) atau finalize
// (COD/bank, finalized_at). Pulangkan hanya kalau salah satu itu berlaku.

export async function restoreStorefrontOrderStock(sb: SB, orderId: string): Promise<'restored' | 'nothing' | 'skipped'> {
  const { data: rows, error } = await sb
    .from('orders')
    .update({ stock_restored_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('stock_restored_at', null)
    .or('finalized_at.not.is.null,payment_status.eq.paid')
    .select('id')
  if (error) {
    if (!MISSING.has(error.code ?? '')) console.error('[stock] order restore claim gagal', error.message)
    return 'skipped'
  }
  if (!rows?.[0]) return 'nothing'

  const { data: items } = await sb
    .from('order_items')
    .select('product_id, variant_id, quantity, product_name')
    .eq('order_id', orderId)
  await restoreItems(sb, (items ?? []) as StockItem[])
  return 'restored'
}
