import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { POS_CASHIER_COOKIE, POS_CASHIER_TTL_SEC, signApproval, signCashier } from '@/lib/pos/pin'
import { checkCashierPin } from '@/lib/pos/cashier-pin'

// Tukar/sahkan kasyer dengan PIN → kuki `pos_cashier` (HMAC, 12 jam). Had: 10 cubaan/minit/IP
// (rateLimitDb) + kunci kasyer 15 minit selepas 5 cubaan salah berturut-turut (lib/pos/cashier-pin, dikongsi void).
// body.verify_only=true → sahkan PIN sahaja (cth kelulusan manager untuk diskaun) tanpa tukar kuki;
// manager → pulangkan juga `approval` (token 15 min) yang klien lampirkan pada jualan supaya server
// benarkan diskaun melebihi had / harga bawah katalog (kuat kuasa di lib/pos/sale.ts).
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  if (!process.env.POS_PIN_SECRET) return NextResponse.json({ error: 'POS_PIN_SECRET is not set on the server' }, { status: 503 })

  const ok = await rateLimitDb(`pos-pin:${clientIp(request)}`, 10, 60_000)
  if (!ok) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const r = await checkCashierPin(auth.supabase!, body.cashier_id, body.pin)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  const cashier = r.cashier
  if (body.verify_only === true) return NextResponse.json({ ok: true, cashier, approval: signApproval(cashier) })

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
