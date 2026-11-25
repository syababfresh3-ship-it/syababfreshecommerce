import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { normalizePhone } from '@/lib/phone'
import { lookupMember } from '@/lib/pos/loyalty'

// Cari pelanggan (customers master) ikut nama/telefon untuk tiket POS — corak sama dengan
// /api/admin/customers/search tetapi gate requirePos (akaun peranti bukan admin).
// Mata loyalty (migration 169): setiap hit disertakan member/points/pending_points ikut telefon; nombor penuh
// yang ahli tetapi belum ada dalam CRM (daftar online, belum beli) dipulangkan juga supaya kasyer nampak mata.
export const dynamic = 'force-dynamic'

interface Hit { id: string; name: string | null; phone_norm: string; order_count: number | null; total_spend: number | null; is_reseller?: boolean | null; member: boolean; member_user_id: string | null; points: number; pending_points: number; multiplier: number }

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
  const sb = auth.supabase!
  const hits: Hit[] = await Promise.all((data ?? []).map(async c => {
    const l = await lookupMember(sb, c.phone_norm)
    return { ...c, member: !!l.member, member_user_id: l.member?.userId ?? null, points: l.member?.points ?? 0, pending_points: l.pending, multiplier: l.member?.multiplier ?? 1 }
  }))
  if (phone && phone.length >= 10 && !hits.some(h => h.phone_norm === phone)) {
    const l = await lookupMember(sb, phone)
    if (l.member) hits.unshift({ id: `member:${l.member.userId}`, name: l.member.name, phone_norm: phone, order_count: null, total_spend: null, member: true, member_user_id: l.member.userId, points: l.member.points, pending_points: l.pending, multiplier: l.member.multiplier })
  }
  return NextResponse.json(hits)
}
