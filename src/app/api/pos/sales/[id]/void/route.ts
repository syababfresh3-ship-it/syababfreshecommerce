import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requirePos } from '@/lib/pos/require-pos'
import { restorePosSaleStock } from '@/lib/pos/stock'
import { checkCashierPin } from '@/lib/pos/cashier-pin'
import { addCashMovement, loadOpenShift, loadShift } from '@/lib/pos/shifts'
import { round2 } from '@/lib/pos/money'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'

// Void jualan — dibenarkan untuk admin, kasyer manager, atau PIN manager (body.manager_id +
// body.manager_pin) yang disahkan di sini dengan kunci akaun yang sama seperti /api/pos/pin
// (lib/pos/cashier-pin) + had 10/min ikut IP DAN ikut manager. Stok dipulangkan sekali (restorePosSaleStock).
// Promo: best-effort, tidak diundur.
// Pengawal kitaran hayat (14 Nov 2026):
//  • baris dalam penyata konsainan → 409 CONSIGN_SETTLED (jumlah penyata beku; padam penyata dulu)
//  • shift jualan dah TUTUP & ada tunai → tunai pulangan direkod sebagai 'cash out' dalam shift TERBUKA register itu
//    (Z lama kekal beku — ia memang tunai yang ada dalam laci hari itu; laporan hari/julat kecualikan void).
//    Tiada shift terbuka → kasyer kena buka kedai dulu (409 SHIFT_CLOSED); admin dibenarkan, respons cash_unrecorded=true.
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>
interface Target { id: string; status: string; shift_id: string | null; register_id: string | null; receipt_no: string | null; pos_sale_items: { consign_settlement_id?: string | null }[] | null; pos_payments: { method: string; amount: number | string; status: string }[] | null }

/** Muat sasaran void; toleran jika migration 158 (consign_settlement_id) belum dijalankan. */
async function loadTarget(sb: SB, id: string): Promise<{ sale: Target | null; error: string | null }> {
  const base = 'id, status, shift_id, register_id, receipt_no, pos_payments(method, amount, status)'
  const full = await sb.from('pos_sales').select(`${base}, pos_sale_items(consign_settlement_id)`).eq('id', id).maybeSingle()
  if (!full.error) return { sale: full.data as Target | null, error: null }
  if (full.error.code !== '42703') return { sale: null, error: full.error.message }
  const lite = await sb.from('pos_sales').select(base).eq('id', id).maybeSingle()
  return lite.error ? { sale: null, error: lite.error.message } : { sale: { ...(lite.data as Target), pos_sale_items: [] }, error: null }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const { id } = await params
  const sb = auth.supabase!
  const body = await request.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''
  if (!reason) return NextResponse.json({ error: 'Void reason required' }, { status: 400 })

  let approvedBy: string | null = auth.cashier?.id ?? null
  const allowed = auth.isAdmin || auth.cashier?.role === 'manager'
  if (!allowed) {
    const managerId = typeof body.manager_id === 'string' ? body.manager_id : ''
    if (!managerId || body.manager_pin == null) return NextResponse.json({ error: 'Manager PIN required', code: 'MANAGER_REQUIRED' }, { status: 403 })
    const okIp = await rateLimitDb(`pos-pin:${clientIp(request)}`, 10, 60_000)
    const okMgr = await rateLimitDb(`pos-pin-mgr:${managerId}`, 10, 60_000)
    if (!okIp || !okMgr) return NextResponse.json({ error: 'Too many PIN attempts' }, { status: 429 })
    const r = await checkCashierPin(sb, managerId, body.manager_pin, { requireManager: true })
    // UI void: 403 + MANAGER_REQUIRED kekal dalam mod PIN manager; 423 (dikunci) dipapar sebagai mesej
    if (!r.ok) return NextResponse.json({ error: r.status === 423 ? r.error : r.status === 401 ? r.error : 'Wrong manager PIN', code: 'MANAGER_REQUIRED' }, { status: r.status === 423 ? 423 : 403 })
    approvedBy = r.cashier.id
  }

  const { sale, error: loadErr } = await loadTarget(sb, id)
  if (loadErr) return NextResponse.json({ error: loadErr }, { status: 500 })
  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  if (sale.status === 'void') return NextResponse.json({ error: 'Sale is already void' }, { status: 409 })
  if ((sale.pos_sale_items ?? []).some(i => i.consign_settlement_id)) {
    return NextResponse.json({ error: 'This sale is already in a consignment statement — delete that statement before voiding', code: 'CONSIGN_SETTLED' }, { status: 409 })
  }

  const cashNet = round2((sale.pos_payments ?? []).filter(p => p.method === 'cash' && p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0))
  const shift = sale.shift_id ? await loadShift(sb, sale.shift_id) : null
  let refundShiftId: string | null = null
  let cashUnrecorded = false
  if (shift?.status === 'closed' && cashNet > 0) {
    const open = await loadOpenShift(sb, sale.register_id)
    if (open) refundShiftId = open.id
    else if (!auth.isAdmin) return NextResponse.json({ error: `That shift is already closed. Open the store first so the RM${cashNet.toFixed(2)} cash refund is recorded in today's drawer`, code: 'SHIFT_CLOSED' }, { status: 409 })
    else cashUnrecorded = true
  }

  const { data: rows, error } = await sb
    .from('pos_sales')
    .update({ status: 'void', voided_at: new Date().toISOString(), voided_by: approvedBy, void_reason: reason })
    .eq('id', id)
    .in('status', ['paid', 'pending'])
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.[0]) return NextResponse.json({ error: 'Sale not found or already void' }, { status: 409 })

  await sb.from('pos_payments').update({ status: 'cancelled' }).eq('sale_id', id).eq('status', 'pending')
  const stock = await restorePosSaleStock(sb, id)
  if (refundShiftId) {
    await addCashMovement(sb, refundShiftId, { type: 'out', amount: cashNet, reason: `Refund ${sale.receipt_no ?? id.slice(0, 8)} (void after shift closed)`, cashierId: approvedBy })
      .catch(e => console.error('[pos-void] rekod tunai pulangan gagal', e instanceof Error ? e.message : e))
  }
  return NextResponse.json({ ok: true, stock, refund_recorded: refundShiftId ? cashNet : null, cash_unrecorded: cashUnrecorded })
}
