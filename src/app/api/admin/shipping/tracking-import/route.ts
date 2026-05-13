import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface TrackingRow {
  order_number: string
  carrier_id: string
  tracking_number: string
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows }: { rows: TrackingRow[] } = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Tiada data' }, { status: 400 })
  }

  const admin = createAdminClient()
  let ok = 0
  const errors: string[] = []

  for (const row of rows) {
    const { order_number, carrier_id, tracking_number } = row
    if (!order_number || !tracking_number) {
      errors.push(`Baris tidak lengkap: ${order_number ?? '?'} — ${tracking_number ?? '?'}`)
      continue
    }

    // Find order
    const { data: order } = await admin
      .from('orders')
      .select('id, status')
      .eq('order_number', order_number.trim())
      .single()

    if (!order) {
      errors.push(`Pesanan tidak dijumpai: ${order_number}`)
      continue
    }

    // Upsert shipment
    const { error: upsertErr } = await admin
      .from('order_shipments')
      .upsert(
        {
          order_id: order.id,
          carrier_id: carrier_id ?? 'ninja_cold',
          tracking_number: tracking_number.trim(),
          status: 'in_transit',
          shipped_at: new Date().toISOString(),
        },
        { onConflict: 'order_id' }
      )

    if (upsertErr) {
      errors.push(`Gagal simpan tracking untuk ${order_number}: ${upsertErr.message}`)
      continue
    }

    // Advance order to 'delivering' if it was confirmed/preparing
    if (order.status === 'confirmed' || order.status === 'preparing') {
      await admin
        .from('orders')
        .update({ status: 'delivering', updated_at: new Date().toISOString() })
        .eq('id', order.id)
    }

    ok++
  }

  return NextResponse.json({ ok, fail: errors.length, errors })
}
