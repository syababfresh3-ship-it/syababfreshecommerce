import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { restoreStorefrontOrderStock } from '@/lib/stock'
import { reverseOrderLoyalty } from '@/lib/loyalty-reverse'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.rpc('cancel_order', { p_order_id: id })

  if (error) return NextResponse.json({ error: 'Gagal batalkan pesanan' }, { status: 500 })

  const result = data as { ok: boolean; error?: string }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  // Audit §4: pulangkan stok (kalau dah dipotong) + mata ditebus. Idempotent.
  const admin = createAdminClient()
  await restoreStorefrontOrderStock(admin, id)
  const { data: o } = await admin.from('orders').select('user_id, total, order_number').eq('id', id).single()
  if (o?.user_id) await reverseOrderLoyalty(admin, { id, ...o }).catch(() => {})

  return NextResponse.json({ ok: true })
}
