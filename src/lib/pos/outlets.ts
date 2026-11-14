import type { SupabaseClient } from '@supabase/supabase-js'

// Outlet, stok outlet & pindahan (DO) — migration 157. Semua fungsi toleran bila 157 belum dijalankan
// (jadual/kolum tiada → null / 'skipped'), supaya POS & admin sedia ada tidak rosak.
//
// Peraturan stok:
//  • HQ (outlet type 'hq') = stok kedai sedia ada (product_variants.stock / inventory_batches) — TIDAK disimpan
//    di pos_outlet_stock. Baris kg di HQ tidak ditolak (lejar kg buah ada di app ops; keputusan pemilik 9 Nov).
//  • Outlet bukan HQ = pos_outlet_stock (pcs & kg), ditulis HANYA melalui applyOutletMovement (lejar lengkap).
//  • Issue DO: dari HQ → tolak stok kedai pek (pos_deduct_stock, tak RAISE; kekurangan → hq_stock_short);
//    ke outlet → transfer_in. Return (outlet → HQ): transfer_out dari outlet; pek masuk semula stok kedai (restore_stock).
//    ATOMIK melalui RPC pos_issue_transfer (migration 161) — satu transaksi untuk nombor + semua stok + status;
//    jatuh ke laluan lama (beberapa panggilan) hanya jika 161 belum dijalankan.
//  • Confirm DO (staf bertugas): received_qty; beza → movement 'adjustment' pada outlet penerima; penerima HQ →
//    stok kedai pek dibetulkan (issue dah kreditkan kuantiti penuh) — 14 Nov, dulu diabaikan → stok HQ terlebih kekal.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export const OUTLET_MISSING = new Set(['42703', '42883', '42P01', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'])
export type PosOutletType = 'hq' | 'bazaar' | 'store'
export type StockUnit = 'pcs' | 'kg'
export type TransferUnit = 'pcs' | 'kg' | 'ctn'
export type TransferStatus = 'draft' | 'issued' | 'confirmed' | 'cancelled'

export interface PosOutlet { id: string; code: string; name: string; type: PosOutletType; location: string | null; is_active: boolean; starts_on: string | null; ends_on: string | null }
export interface TransferItemInput { product_id: string | null; variant_id: string | null; name: string; variant_name: string | null; unit: TransferUnit; qty: number; pack_size: number | null; note?: string | null }
export interface TransferItemRow extends TransferItemInput { id: string; transfer_id: string; sort: number; base_unit: StockUnit; base_qty: number; received_qty: number | null; hq_stock_short: number }
export interface TransferRow {
  id: string; doc_no: string | null; kind: 'out' | 'return'; from_outlet_id: string; to_outlet_id: string; status: TransferStatus
  note: string | null; created_by: string | null; created_at: string; updated_at: string
  issued_at: string | null; issued_by: string | null; stock_applied_at: string | null
  confirmed_at: string | null; confirmed_by: string | null; confirmed_cashier_id: string | null; confirmed_note: string | null
  from_outlet?: PosOutlet | null; to_outlet?: PosOutlet | null; confirmed_cashier?: { name: string } | null
  pos_transfer_items?: TransferItemRow[]
}

const n3 = (v: number) => Math.round(v * 1000) / 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Normalisasi baris DO: ctn × pack_size → pcs; kg kekal kg. Ralat → string. */
export function normalizeTransferItem(raw: unknown, sort: number): { item: Omit<TransferItemRow, 'id' | 'transfer_id' | 'received_qty' | 'hq_stock_short'> } | { error: string } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 120) : ''
  if (!name) return { error: `Line ${sort + 1}: name is required` }
  const unit = o.unit === 'kg' ? 'kg' : o.unit === 'ctn' ? 'ctn' : o.unit === 'pcs' ? 'pcs' : null
  if (!unit) return { error: `Line ${sort + 1} (${name}): unit must be pcs, kg or ctn` }
  const qty = Number(o.qty)
  if (!Number.isFinite(qty) || qty <= 0) return { error: `Line ${sort + 1} (${name}): quantity must be more than 0` }
  const pack = o.pack_size == null || o.pack_size === '' ? null : Number(o.pack_size)
  if (unit === 'ctn' && (!pack || !Number.isFinite(pack) || pack <= 0)) return { error: `Line ${sort + 1} (${name}): pack size (pcs per carton) is required` }
  const productId = typeof o.product_id === 'string' && UUID.test(o.product_id) ? o.product_id : null
  const variantId = typeof o.variant_id === 'string' && UUID.test(o.variant_id) ? o.variant_id : null
  const base_unit: StockUnit = unit === 'kg' ? 'kg' : 'pcs'
  const base_qty = n3(unit === 'ctn' ? qty * (pack as number) : qty)
  return { item: { sort, product_id: productId, variant_id: variantId, name, variant_name: typeof o.variant_name === 'string' ? o.variant_name.trim().slice(0, 80) || null : null, unit, qty: n3(qty), pack_size: unit === 'ctn' ? n3(pack as number) : null, base_unit, base_qty, note: typeof o.note === 'string' ? o.note.trim().slice(0, 200) || null : null } }
}

export async function loadOutlets(sb: SB): Promise<PosOutlet[] | null> {
  const { data, error } = await sb.from('pos_outlets').select('*').order('type').order('code')
  if (error) return null
  return (data ?? []) as PosOutlet[]
}

export async function loadOutletOfRegister(sb: SB, registerId: string | null | undefined): Promise<PosOutlet | null> {
  if (!registerId || !UUID.test(registerId)) return null
  const { data, error } = await sb.from('pos_registers').select('outlet_id, pos_outlets(*)').eq('id', registerId).maybeSingle()
  if (error || !data) return null
  const o = (Array.isArray(data.pos_outlets) ? data.pos_outlets[0] : data.pos_outlets) as PosOutlet | null
  return o ?? null
}

export async function loadOutletOfSale(sb: SB, saleId: string): Promise<PosOutlet | null> {
  const { data, error } = await sb.from('pos_sales').select('outlet_id, pos_outlets(*)').eq('id', saleId).maybeSingle()
  if (error || !data) return null
  const o = (Array.isArray(data.pos_outlets) ? data.pos_outlets[0] : data.pos_outlets) as PosOutlet | null
  return o ?? null
}

export interface Movement {
  outletId: string; productId: string; variantId: string | null; unit: StockUnit; delta: number
  type: 'transfer_in' | 'transfer_out' | 'sale' | 'void_restore' | 'adjustment' | 'wastage' | 'count'
  refType?: 'transfer' | 'sale' | null; refId?: string | null; note?: string | null; userId?: string | null; cashierId?: string | null
}

/** Ubah stok outlet (RPC clamp 0, pulang kekurangan) + tulis lejar. Pulang kekurangan (0 jika cukup). */
export async function applyOutletMovement(sb: SB, m: Movement): Promise<{ short: number; error?: string }> {
  if (!m.delta) return { short: 0 }
  const { data: short, error } = await sb.rpc('pos_outlet_stock_apply', { p_outlet: m.outletId, p_product: m.productId, p_variant: m.variantId, p_unit: m.unit, p_delta: n3(m.delta) })
  if (error) return { short: 0, error: error.message }
  const shortN = Number(short ?? 0)
  const applied = m.delta < 0 ? n3(m.delta + shortN) : n3(m.delta)    // yang benar-benar ditolak
  await sb.from('pos_stock_movements').insert({
    outlet_id: m.outletId, product_id: m.productId, variant_id: m.variantId, unit: m.unit, qty: applied, type: m.type,
    ref_type: m.refType ?? null, ref_id: m.refId ?? null, note: shortN > 0 ? `${m.note ?? ''}${m.note ? ' · ' : ''}short ${shortN}`.trim() : m.note ?? null,
    created_by: m.userId ?? null, cashier_id: m.cashierId ?? null,
  })
  return { short: shortN }
}

export async function loadTransfer(sb: SB, id: string): Promise<TransferRow | null> {
  const { data, error } = await sb.from('pos_transfers')
    .select('*, from_outlet:pos_outlets!from_outlet_id(*), to_outlet:pos_outlets!to_outlet_id(*), confirmed_cashier:pos_cashiers!confirmed_cashier_id(name), pos_transfer_items(*)')
    .eq('id', id).maybeSingle()
  if (error || !data) return null
  const t = data as TransferRow
  t.pos_transfer_items = (t.pos_transfer_items ?? []).slice().sort((a, b) => a.sort - b.sort)
  return t
}

export class TransferError extends Error { constructor(message: string, public status = 400) { super(message) } }

/** Issue DO: nombor + stok (HQ pek ditolak, outlet masuk) — satu transaksi (RPC 161). */
export async function issueTransfer(sb: SB, id: string, ctx: { userId: string | null }): Promise<TransferRow> {
  const t = await loadTransfer(sb, id)
  if (!t) throw new TransferError('Transfer not found', 404)
  if (t.status !== 'draft') throw new TransferError(`Transfer is already ${t.status}`, 409)
  if (!t.pos_transfer_items?.length) throw new TransferError('Add at least one line before issuing')

  const { data: rpc, error: rpcErr } = await sb.rpc('pos_issue_transfer', { p_transfer: id, p_user: ctx.userId })
  if (!rpcErr) {
    const r = (rpc ?? {}) as { ok?: boolean; status?: number; error?: string }
    if (!r.ok) throw new TransferError(r.error ?? 'Issue failed', r.status ?? 400)
    return (await loadTransfer(sb, id))!
  }
  if (!OUTLET_MISSING.has(rpcErr.code ?? '')) throw new TransferError(rpcErr.message, 500)

  // Fallback (161 belum dijalankan): laluan lama, beberapa panggilan. stock_applied_at hanya ditanda SELEPAS semua
  // baris — kalau terhenti separuh jalan, DO nampak "issued" tanpa tarikh stok supaya admin tahu ia perlu disemak.
  const { data: docNo, error: nErr } = await sb.rpc('pos_next_transfer_no')
  if (nErr) throw new TransferError(nErr.message, 500)
  const now = new Date().toISOString()
  const { data: claimed, error: cErr } = await sb.from('pos_transfers')
    .update({ status: 'issued', doc_no: docNo, issued_at: now, issued_by: ctx.userId, updated_at: now })
    .eq('id', id).eq('status', 'draft').select('id')
  if (cErr) throw new TransferError(cErr.message, 500)
  if (!claimed?.[0]) throw new TransferError('Transfer was issued by someone else', 409)

  const from = t.from_outlet!, to = t.to_outlet!
  for (const it of t.pos_transfer_items) {
    if (!it.product_id) continue                      // baris bebas (nama sahaja) — tiada stok
    // Keluar dari sumber
    if (from.type === 'hq') {
      if (it.base_unit === 'pcs') {
        const { data: short, error } = await sb.rpc('pos_deduct_stock', { p_product_id: it.product_id, p_variant_id: it.variant_id, p_qty: Math.round(it.base_qty) })
        if (!error && Number(short ?? 0) > 0) await sb.from('pos_transfer_items').update({ hq_stock_short: Number(short) }).eq('id', it.id)
      }
    } else {
      await applyOutletMovement(sb, { outletId: from.id, productId: it.product_id, variantId: it.variant_id, unit: it.base_unit, delta: -it.base_qty, type: 'transfer_out', refType: 'transfer', refId: t.id, note: docNo, userId: ctx.userId })
    }
    // Masuk ke destinasi
    if (to.type === 'hq') {
      if (it.base_unit === 'pcs') await sb.rpc('restore_stock', { p_product_id: it.product_id, p_variant_id: it.variant_id, p_quantity: Math.round(it.base_qty) })
    } else {
      await applyOutletMovement(sb, { outletId: to.id, productId: it.product_id, variantId: it.variant_id, unit: it.base_unit, delta: it.base_qty, type: 'transfer_in', refType: 'transfer', refId: t.id, note: docNo, userId: ctx.userId })
    }
  }
  await sb.from('pos_transfers').update({ stock_applied_at: new Date().toISOString() }).eq('id', id)
  return (await loadTransfer(sb, id))!
}

/** Pengesahan di outlet penerima oleh staf bertugas. Beza diterima vs dihantar → 'adjustment' pada outlet;
 *  penerima HQ (DO pulangan) → stok kedai pek dibetulkan dengan beza itu (issue dah kreditkan kuantiti penuh). */
export async function confirmTransfer(sb: SB, id: string, received: { id: string; received_qty: number }[], ctx: { userId: string | null; cashierId: string | null; note?: string | null }): Promise<TransferRow> {
  const t = await loadTransfer(sb, id)
  if (!t) throw new TransferError('Transfer not found', 404)
  if (t.status !== 'issued') throw new TransferError(t.status === 'confirmed' ? 'Transfer is already confirmed' : `Transfer is ${t.status}`, 409)
  const recMap = new Map(received.filter(r => typeof r.id === 'string' && Number.isFinite(Number(r.received_qty)) && Number(r.received_qty) >= 0).map(r => [r.id, n3(Number(r.received_qty))]))
  const now = new Date().toISOString()
  const { data: claimed, error: cErr } = await sb.from('pos_transfers')
    .update({ status: 'confirmed', confirmed_at: now, confirmed_by: ctx.userId, confirmed_cashier_id: ctx.cashierId, confirmed_note: ctx.note?.trim().slice(0, 300) || null, updated_at: now })
    .eq('id', id).eq('status', 'issued').select('id')
  if (cErr) throw new TransferError(cErr.message, 500)
  if (!claimed?.[0]) throw new TransferError('Transfer was confirmed by someone else', 409)
  const to = t.to_outlet!
  for (const it of t.pos_transfer_items ?? []) {
    const rec = recMap.has(it.id) ? recMap.get(it.id)! : it.base_qty
    await sb.from('pos_transfer_items').update({ received_qty: rec }).eq('id', it.id)
    const diff = n3(rec - it.base_qty)
    if (diff === 0 || !it.product_id) continue
    if (to.type !== 'hq') {
      await applyOutletMovement(sb, { outletId: to.id, productId: it.product_id, variantId: it.variant_id, unit: it.base_unit, delta: diff, type: 'adjustment', refType: 'transfer', refId: t.id, note: `${t.doc_no ?? 'DO'} variance (sent ${it.base_qty}, received ${rec})`, userId: ctx.userId, cashierId: ctx.cashierId })
    } else if (it.base_unit === 'pcs') {
      // HQ: issue dah masukkan base_qty penuh ke stok kedai → terima kurang = tolak beza, terima lebih = tambah beza (kg HQ tak dijejak)
      const n = Math.round(Math.abs(diff))
      if (n > 0) {
        if (diff < 0) await sb.rpc('pos_deduct_stock', { p_product_id: it.product_id, p_variant_id: it.variant_id, p_qty: n })
        else await sb.rpc('restore_stock', { p_product_id: it.product_id, p_variant_id: it.variant_id, p_quantity: n })
      }
    }
  }
  return (await loadTransfer(sb, id))!
}

export async function cancelTransfer(sb: SB, id: string): Promise<TransferRow> {
  const t = await loadTransfer(sb, id)
  if (!t) throw new TransferError('Transfer not found', 404)
  if (t.status !== 'draft') throw new TransferError('Only drafts can be cancelled (issued stock has already moved — create a return instead)', 409)
  await sb.from('pos_transfers').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft')
  return (await loadTransfer(sb, id))!
}

export interface OutletStockRow { id: string; outlet_id: string; product_id: string; variant_id: string | null; unit: StockUnit; qty: number; updated_at: string; name: string; variant_name: string | null }

/** Stok outlet dengan nama produk/varian (nama diambil dari katalog kedai; produk dipadam → id dipendekkan). */
export async function loadOutletStock(sb: SB, outletId: string): Promise<OutletStockRow[] | null> {
  const { data, error } = await sb.from('pos_outlet_stock').select('*, products(name), product_variants(name)').eq('outlet_id', outletId).order('updated_at', { ascending: false })
  if (error) return null
  type R = { id: string; outlet_id: string; product_id: string; variant_id: string | null; unit: StockUnit; qty: number | string; updated_at: string; products: { name: string } | null; product_variants: { name: string } | null }
  return ((data ?? []) as R[]).map(r => ({ id: r.id, outlet_id: r.outlet_id, product_id: r.product_id, variant_id: r.variant_id, unit: r.unit, qty: Number(r.qty), updated_at: r.updated_at, name: r.products?.name ?? r.product_id.slice(0, 8), variant_name: r.variant_id ? (r.product_variants?.name ?? null) : (r.unit === 'kg' ? 'by weight' : null) }))
    .sort((a, b) => a.name.localeCompare(b.name) || (a.variant_name ?? '').localeCompare(b.variant_name ?? ''))
}
