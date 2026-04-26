import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total, payment_method, payment_status, created_at, notes, delivery_slot, user_id, order_items(product_name, quantity)')
    .in('status', ['pending', 'confirmed', 'preparing', 'delivering'])
    .order('created_at', { ascending: true })

  if (!orders || orders.length === 0) return NextResponse.json([])

  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds)

  const profileMap: Record<string, { full_name: string; phone: string }> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p

  const enriched = orders.map((o: any) => ({
    ...o,
    profiles: profileMap[o.user_id] ?? null,
  }))

  return NextResponse.json(enriched)
}
