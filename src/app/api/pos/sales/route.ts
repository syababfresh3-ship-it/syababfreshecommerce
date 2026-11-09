import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { createSale, PosSaleError } from '@/lib/pos/sale'
import { klDateStr, klDayWindow, isValidYmd } from '@/lib/daily-summary'

// POST: cipta jualan (perlu kuki PIN kasyer; admin tanpa PIN juga dibenarkan). Idempoten ikut
//       client_txn_id — replay offline / tekan dua kali pulangkan baris sama dengan duplicate=true.
// GET : senarai jualan satu hari (?date=YYYY-MM-DD, lalai hari ini KL; ?register=).
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  if (!auth.cashier && !auth.isAdmin) return NextResponse.json({ error: 'Cashier PIN required', code: 'PIN_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  try {
    const r = await createSale(auth.supabase!, body, { userId: auth.user!.id, cashierId: auth.cashier?.id ?? null })
    const { data } = await auth.supabase!.from('pos_sales').select('public_token, total, change_given').eq('id', r.id).maybeSingle()
    return NextResponse.json({ ...r, public_token: data?.public_token ?? null, total: data ? Number(data.total) : null, change_given: data ? Number(data.change_given) : null }, { status: r.duplicate ? 200 : 201 })
  } catch (e) {
    if (e instanceof PosSaleError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[pos/sales] gagal', e)
    return NextResponse.json({ error: 'Failed to save sale' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const sp = new URL(request.url).searchParams
  const date = isValidYmd(sp.get('date')) ? sp.get('date')! : klDateStr(new Date())
  const register = sp.get('register')
  const { start, end } = klDayWindow(date)

  let q = auth.supabase!
    .from('pos_sales')
    .select('id, receipt_no, local_ref, status, total, paid_total, change_given, weight_kg_total, sold_at, customer_name, customer_phone, offline, void_reason, public_token, cashier_id, pos_cashiers!cashier_id(name), pos_payments(method, amount, status)')
    .gte('sold_at', start).lt('sold_at', end)
    .order('sold_at', { ascending: false })
    .limit(400)
  if (register) q = q.eq('register_id', register)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message, sales: [] }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ date, sales: data ?? [] })
}
