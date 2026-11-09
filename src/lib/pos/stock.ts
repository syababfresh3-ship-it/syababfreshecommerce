import type { SupabaseClient } from '@supabase/supabase-js'
import { sendAdminPush } from '@/lib/push'
import { applyOutletMovement, loadOutletOfSale } from '@/lib/pos/outlets'

// Stok untuk jualan POS — cermin corak lib/stock.ts (tuntutan atomik stock_deducted_at /
// stock_restored_at, sekali sahaja) tetapi:
//  • guna RPC pos_deduct_stock (155) yang TIDAK raise bila stok kurang — jualan kaunter tak boleh
//    gagal kerana angka stok; kekurangan direkod pada baris (stock_short) + nota + push admin.
//  • baris ikut berat (unit 'kg') TIDAK sentuh stok kedai (stok kedai = unit pek integer;
//    kg buah longgar dijejak di app ops). Direkod weight_kg_total untuk laporan.
// Pulang stok guna restore_stock (123) — hanya tambah.
//  • OUTLET (migration 157): jika jualan berlaku di register outlet bukan-HQ, stok OUTLET (pcs & kg) ditolak
//    melalui applyOutletMovement (lejar 'sale' / 'void_restore'), BUKAN stok kedai. Toleran bila 157 belum run.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

const MISSING = new Set(['42703', '42883', '42P01', 'PGRST202', 'PGRST204', 'PGRST205'])

interface ItemRow { id: string; product_id: string | null; variant_id: string | null; name: string; unit: 'pcs' | 'kg'; qty: number | string; stock_deducted: boolean; stock_short: number | string }

export async function deductPosSaleStock(sb: SB, saleId: string): Promise<'deducted' | 'short' | 'already' | 'skipped'> {
  const { data: rows, error } = await sb
    .from('pos_sales')
    .update({ stock_deducted_at: new Date().toISOString() })
    .eq('id', saleId)
    .is('stock_deducted_at', null)
    .select('id, receipt_no, stock_notes')
  if (error) {
    if (!MISSING.has(error.code ?? '')) console.error('[pos-stock] claim gagal', error.message)
    return 'skipped'
  }
  const sale = rows?.[0]
  if (!sale) return 'already'

  const { data: items } = await sb
    .from('pos_sale_items')
    .select('id, product_id, variant_id, name, unit, qty, stock_deducted, stock_short')
    .eq('sale_id', saleId)

  // Jualan di outlet bukan-HQ → tolak stok outlet (pcs & kg), bukan stok kedai
  const outlet = await loadOutletOfSale(sb, saleId)
  if (outlet && outlet.type !== 'hq') {
    const shorts: string[] = []
    for (const it of ((items ?? []) as ItemRow[])) {
      if (!it.product_id || Number(it.qty) <= 0) continue
      const r = await applyOutletMovement(sb, { outletId: outlet.id, productId: it.product_id, variantId: it.variant_id, unit: it.unit, delta: -Number(it.qty), type: 'sale', refType: 'sale', refId: saleId, note: sale.receipt_no })
      if (r.error) { console.error('[pos-stock] outlet deduct gagal', it.id, r.error); continue }
      await sb.from('pos_sale_items').update({ stock_deducted: true, stock_short: r.short }).eq('id', it.id)
      if (r.short > 0) shorts.push(`${it.name} (short ${r.short})`)
    }
    if (shorts.length === 0) return 'deducted'
    const note = `OUTLET ${outlet.code} STOCK SHORT: ${shorts.join(', ')}`
    await sb.from('pos_sales').update({ stock_notes: sale.stock_notes ? `${sale.stock_notes}\n${note}` : note }).eq('id', saleId)
    sendAdminPush({ title: `Stok outlet ${outlet.code} kurang: ${sale.receipt_no ?? saleId.slice(0, 8)}`, body: shorts.join(', ').slice(0, 120), url: '/admin/pos/outlets', tag: 'pos-short' }).catch(() => {})
    return 'short'
  }

  const packed = ((items ?? []) as ItemRow[]).filter(i => i.unit === 'pcs' && i.product_id && Number(i.qty) > 0)
  if (packed.length === 0) return 'deducted'

  const shorts: string[] = []
  for (const it of packed) {
    const qty = Math.round(Number(it.qty))
    const { data: short, error: e } = await sb.rpc('pos_deduct_stock', { p_product_id: it.product_id, p_variant_id: it.variant_id, p_qty: qty })
    if (e) {
      if (!MISSING.has(e.code ?? '')) console.error('[pos-stock] deduct gagal', it.id, e.message)
      continue
    }
    const shortN = Number(short ?? 0)
    await sb.from('pos_sale_items').update({ stock_deducted: true, stock_short: shortN }).eq('id', it.id)
    if (shortN > 0) shorts.push(`${it.name} (short ${shortN})`)
  }
  if (shorts.length === 0) return 'deducted'

  const note = `STORE STOCK SHORT: ${shorts.join(', ')}`
  await sb.from('pos_sales').update({ stock_notes: sale.stock_notes ? `${sale.stock_notes}\n${note}` : note }).eq('id', saleId)
  sendAdminPush({ title: `Stok POS kurang: ${sale.receipt_no ?? saleId.slice(0, 8)}`, body: shorts.join(', ').slice(0, 120), url: '/admin/pos/sales', tag: 'pos-short' }).catch(() => {})
  return 'short'
}

export async function restorePosSaleStock(sb: SB, saleId: string): Promise<'restored' | 'nothing' | 'skipped'> {
  const { data: rows, error } = await sb
    .from('pos_sales')
    .update({ stock_restored_at: new Date().toISOString() })
    .eq('id', saleId)
    .not('stock_deducted_at', 'is', null)
    .is('stock_restored_at', null)
    .select('id')
  if (error) {
    if (!MISSING.has(error.code ?? '')) console.error('[pos-stock] restore claim gagal', error.message)
    return 'skipped'
  }
  if (!rows?.[0]) return 'nothing'

  const { data: items } = await sb
    .from('pos_sale_items')
    .select('id, product_id, variant_id, name, unit, qty, stock_deducted, stock_short')
    .eq('sale_id', saleId)

  // Jualan outlet bukan-HQ → pulang ke stok outlet (pcs & kg) yang benar-benar ditolak
  const outlet = await loadOutletOfSale(sb, saleId)
  if (outlet && outlet.type !== 'hq') {
    for (const it of ((items ?? []) as ItemRow[])) {
      if (!it.stock_deducted || !it.product_id) continue
      const qty = Math.round((Number(it.qty) - Number(it.stock_short)) * 1000) / 1000
      if (qty <= 0) continue
      await applyOutletMovement(sb, { outletId: outlet.id, productId: it.product_id, variantId: it.variant_id, unit: it.unit, delta: qty, type: 'void_restore', refType: 'sale', refId: saleId })
    }
    return 'restored'
  }

  for (const it of ((items ?? []) as ItemRow[])) {
    if (!it.stock_deducted || !it.product_id || it.unit !== 'pcs') continue
    const qty = Math.round(Number(it.qty)) - Math.round(Number(it.stock_short))   // pulang hanya yang benar-benar ditolak
    if (qty <= 0) continue
    const { error: e } = await sb.rpc('restore_stock', { p_product_id: it.product_id, p_variant_id: it.variant_id, p_quantity: qty })
    if (e && !MISSING.has(e.code ?? '')) console.error('[pos-stock] restore gagal', it.id, e.message)
  }
  return 'restored'
}
