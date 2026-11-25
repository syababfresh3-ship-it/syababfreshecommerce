import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { createSale, PosSaleError } from '@/lib/pos/sale'
import { klDateStr, klDayWindow, isValidYmd } from '@/lib/daily-summary'

// POST: cipta jualan (perlu kuki PIN kasyer; admin tanpa PIN juga dibenarkan). Idempoten ikut
//       client_txn_id — replay offline / tekan dua kali pulangkan baris sama dengan duplicate=true.
//       Ralat berkod (STORE_CLOSED, MANAGER_REQUIRED, CATALOG_CHANGED, PROMO_*) → { error, code } untuk UI.
// GET : senarai jualan satu hari (?date=YYYY-MM-DD, lalai hari ini KL; ?register=).
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  if (!auth.cashier && !auth.isAdmin) return NextResponse.json({ error: 'Cashier PIN required', code: 'PIN_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  try {
    const r = await createSale(auth.supabase!, body, { userId: auth.user!.id, cashierId: auth.cashier?.id ?? null, privileged: auth.isAdmin || auth.cashier?.role === 'manager' })
    const { data } = await auth.supabase!.from('pos_sales').select('public_token, total, change_given').eq('id', r.id).maybeSingle()
    return NextResponse.json({ ...r, loyalty: r.loyalty ?? null, public_token: data?.public_token ?? null, total: data ? Number(data.total) : null, change_given: data ? Number(data.change_given) : null }, { status: r.duplicate ? 200 : 201 })
  } catch (e) {
    if (e instanceof PosSaleError) return NextResponse.json({ error: e.message, code: e.code ?? undefined }, { status: e.status })
    console.error('[pos/sales] gagal', e)
    return NextResponse.json({ error: 'Failed to save sale' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const sp = new URL(request.url).searchParams
  const sb = auth.supabase!
  // ?pending=1 → order pickup / pending (semua register, 60 hari) — Sales › Pickups waiting (migration 170)
  if (sp.get('pending') === '1') {
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const { data, error } = await sb.from('pos_sales')
      .select('*, pos_cashiers!cashier_id(name), pos_payments(method, amount, status)')
      .eq('status', 'pending').gte('sold_at', since).order('sold_at', { ascending: false }).limit(200)
    if (error) return NextResponse.json({ error: error.message, sales: [] }, { status: 500 })
    return NextResponse.json({ sales: data ?? [] })
  }
  // ?credit=1 → jualan dengan kredit belum diselesaikan (baris pos_payments method credit, settled_at null)
  if (sp.get('credit') === '1') {
    const { data, error } = await sb.from('pos_payments')
      .select('sale_id, amount, paid_at, pos_sales!inner(*, pos_cashiers!cashier_id(name))')
      .eq('method', 'credit').eq('status', 'paid').is('settled_at', null).order('paid_at', { ascending: false }).limit(300)
    if (error) return NextResponse.json({ sales: [], error: error.code === '42703' ? 'Migration 170 (POS pickup/credit) has not been run' : error.message }, { status: error.code === '42703' ? 200 : 500 })
    const bySale = new Map<string, Record<string, unknown> & { credit_outstanding: number }>()
    for (const p of (data ?? []) as { sale_id: string; amount: number | string; pos_sales: Record<string, unknown> | Record<string, unknown>[] }[]) {
      const sale = Array.isArray(p.pos_sales) ? p.pos_sales[0] : p.pos_sales
      if (!sale) continue
      const cur = bySale.get(p.sale_id) ?? { ...sale, pos_payments: [{ method: 'credit', amount: 0, status: 'paid' }], credit_outstanding: 0 }
      cur.credit_outstanding = Math.round((cur.credit_outstanding + Number(p.amount)) * 100) / 100
      ;(cur.pos_payments as { amount: number }[])[0].amount = cur.credit_outstanding
      bySale.set(p.sale_id, cur)
    }
    return NextResponse.json({ sales: Array.from(bySale.values()) })
  }
  const date = isValidYmd(sp.get('date')) ? sp.get('date')! : klDateStr(new Date())
  const register = sp.get('register')
  const { start, end } = klDayWindow(date)

  const COLS = 'id, receipt_no, local_ref, status, total, paid_total, change_given, weight_kg_total, sold_at, customer_name, customer_phone, offline, void_reason, public_token, cashier_id, pos_cashiers!cashier_id(name), pos_payments(method, amount, status)'
  const dayQuery = (cols: string) => {
    let q = sb.from('pos_sales').select(cols).gte('sold_at', start).lt('sold_at', end).order('sold_at', { ascending: false }).limit(400)
    if (register) q = q.eq('register_id', register)
    return q
  }
  // 171: channel (Borong) — fallback tanpa lajur bila migration belum dijalankan
  let { data, error } = await dayQuery(`${COLS}, channel, is_pickup`)
  if (error?.code === '42703') ({ data, error } = await dayQuery(COLS))
  if (error) return NextResponse.json({ error: error.message, sales: [] }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ date, sales: data ?? [] })
}
