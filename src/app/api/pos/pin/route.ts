import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { POS_CASHIER_COOKIE, POS_CASHIER_TTL_SEC, isValidPin, signCashier, verifyPin } from '@/lib/pos/pin'

// Tukar/sahkan kasyer dengan PIN → kuki `pos_cashier` (HMAC, 12 jam). Had: 10 cubaan/minit/IP
// (rateLimitDb) + kunci kasyer 15 minit selepas 5 cubaan salah berturut-turut.
// body.verify_only=true → sahkan PIN sahaja (cth kelulusan manager untuk diskaun) tanpa tukar kuki.
export const dynamic = 'force-dynamic'

const LOCK_AFTER = 5
const LOCK_MINUTES = 15

export async function POST(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  if (!process.env.POS_PIN_SECRET) return NextResponse.json({ error: 'POS_PIN_SECRET is not set on the server' }, { status: 503 })

  const ok = await rateLimitDb(`pos-pin:${clientIp(request)}`, 10, 60_000)
  if (!ok) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const cashierId = typeof body.cashier_id === 'string' ? body.cashier_id : ''
  const pin = body.pin
  if (!cashierId || !isValidPin(pin)) return NextResponse.json({ error: 'A 4–6 digit PIN is required' }, { status: 400 })

  const sb = auth.supabase!
  const { data: c, error } = await sb.from('pos_cashiers').select('id, name, role, pin_hash, is_active, failed_attempts, locked_until').eq('id', cashierId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!c || !c.is_active) return NextResponse.json({ error: 'Cashier not found' }, { status: 404 })
  if (c.locked_until && new Date(c.locked_until) > new Date()) {
    return NextResponse.json({ error: `Cashier locked. Try again after ${new Date(c.locked_until).toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' })}` }, { status: 423 })
  }

  if (!verifyPin(pin, c.pin_hash)) {
    const attempts = (c.failed_attempts ?? 0) + 1
    const patch: Record<string, unknown> = { failed_attempts: attempts }
    if (attempts >= LOCK_AFTER) { patch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString(); patch.failed_attempts = 0 }
    await sb.from('pos_cashiers').update(patch).eq('id', c.id)
    return NextResponse.json({ error: attempts >= LOCK_AFTER ? `Wrong PIN ${LOCK_AFTER} times — locked for ${LOCK_MINUTES} minutes` : 'Wrong PIN' }, { status: 401 })
  }

  await sb.from('pos_cashiers').update({ failed_attempts: 0, locked_until: null }).eq('id', c.id)
  const cashier = { id: c.id, name: c.name, role: c.role === 'manager' ? 'manager' as const : 'cashier' as const }
  if (body.verify_only === true) return NextResponse.json({ ok: true, cashier })

  const token = signCashier(cashier)
  if (!token) return NextResponse.json({ error: 'Failed to sign cashier session' }, { status: 500 })

  const res = NextResponse.json({ cashier })
  res.cookies.set(POS_CASHIER_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: POS_CASHIER_TTL_SEC })
  return res
}

export async function DELETE() {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const res = NextResponse.json({ ok: true })
  res.cookies.set(POS_CASHIER_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
  return res
}
