import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { normalizePhone } from '@/lib/phone'

// Cari pelanggan (customers master) ikut nama/telefon untuk tiket POS — corak sama dengan
// /api/admin/customers/search tetapi gate requirePos (akaun peranti bukan admin).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 3) return NextResponse.json([])
  const safe = q.replace(/[,()*\\]/g, ' ').trim()
  if (!safe) return NextResponse.json([])

  const phone = normalizePhone(q)
  const orParts = [`name.ilike.%${safe}%`]
  if (phone) orParts.push(`phone_norm.ilike.%${phone}%`)

  const { data, error } = await auth.supabase!
    .from('customers')
    .select('id, name, phone_norm, order_count, total_spend, is_reseller')
    .or(orParts.join(','))
    .order('last_order_at', { ascending: false, nullsFirst: false })
    .limit(10)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
