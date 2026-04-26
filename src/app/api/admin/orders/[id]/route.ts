import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  const body = await request.json()
  const { status, payment_status, payment_ref } = body

  const now = new Date().toISOString()
  const update: Record<string, string | null> = {}

  if (status) {
    update.status = status
    if (status === 'confirmed')  update.confirmed_at  = now
    if (status === 'preparing')  update.preparing_at  = now
    if (status === 'delivering') update.delivering_at = now
    if (status === 'delivered')  update.delivered_at  = now
    if (status === 'cancelled')  update.cancelled_at  = now
    // bila set refunded, bayaran juga auto-refunded
    if (status === 'refunded')   update.payment_status = 'refunded'
  }
  if (payment_status) update.payment_status = payment_status
  if (payment_ref !== undefined) update.payment_ref = payment_ref

  const { error } = await supabase.from('orders').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
