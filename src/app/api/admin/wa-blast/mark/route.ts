import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// Tandakan order sebagai 'dah diblast' (wa_blasted_at = now) selepas admin Download CSV
// di /admin/wa-blast. order_number berawalan 'LP-' → lp_guest_orders, selainnya → orders.
export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json().catch(() => null)
  const orderNumbers: unknown = body?.order_numbers
  if (!Array.isArray(orderNumbers) || orderNumbers.length === 0) {
    return NextResponse.json({ error: 'order_numbers required' }, { status: 400 })
  }

  const nums = orderNumbers.filter((n): n is string => typeof n === 'string' && n.length > 0)
  const lpNums = nums.filter((n) => n.startsWith('LP-'))
  const shopNums = nums.filter((n) => !n.startsWith('LP-'))
  const now = new Date().toISOString()

  const results = await Promise.all([
    shopNums.length
      ? supabase!.from('orders').update({ wa_blasted_at: now }).in('order_number', shopNums)
      : Promise.resolve({ error: null }),
    lpNums.length
      ? supabase!.from('lp_guest_orders').update({ wa_blasted_at: now }).in('order_number', lpNums)
      : Promise.resolve({ error: null }),
  ])

  const err = results.find((r) => r.error)?.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  return NextResponse.json({ ok: true, marked: nums.length, at: now })
}
