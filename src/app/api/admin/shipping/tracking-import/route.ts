import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { sendTrackingEmail } from '@/lib/zeptomail'
import { sendUserPush } from '@/lib/push'

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

  // Cache template carrier (elak query berulang untuk carrier sama)
  const carrierCache = new Map<string, { name: string | null; template: string | null }>()
  async function getCarrier(id: string) {
    if (!carrierCache.has(id)) {
      const { data } = await admin
        .from('shipping_carriers')
        .select('name, tracking_url_template')
        .eq('id', id)
        .maybeSingle()
      carrierCache.set(id, { name: data?.name ?? null, template: data?.tracking_url_template ?? null })
    }
    return carrierCache.get(id)!
  }

  // Notifikasi customer dikumpul & ditunggu di hujung supaya loop laju & tak terputus
  const notifs: Promise<unknown>[] = []

  for (const row of rows) {
    const order_number = row.order_number
    const tracking_number = row.tracking_number
    const carrier_id = row.carrier_id || 'ninja_cold'
    if (!order_number || !tracking_number) {
      errors.push(`Baris tidak lengkap: ${order_number ?? '?'} — ${tracking_number ?? '?'}`)
      continue
    }

    // Cari order
    const { data: order } = await admin
      .from('orders')
      .select('id, status, order_number, user_id')
      .eq('order_number', order_number.trim())
      .single()

    if (!order) {
      errors.push(`Pesanan tidak dijumpai: ${order_number}`)
      continue
    }

    const tn = tracking_number.trim()
    const carrier = await getCarrier(carrier_id)
    // Jana link tracking dari template carrier (cth https://.../{number})
    const tracking_url = carrier.template ? carrier.template.replace('{number}', tn) : null

    // Upsert PRIMARY shipment (refund_id is null) — biarkan shipment ganti (refund) sendiri
    const shipRow = {
      order_id: order.id,
      carrier_id,
      tracking_number: tn,
      tracking_url,
      status: 'in_transit',
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data: existingShip } = await admin
      .from('order_shipments')
      .select('id')
      .eq('order_id', order.id)
      .is('refund_id', null)
      .maybeSingle()
    const { error: upsertErr } = existingShip
      ? await admin.from('order_shipments').update(shipRow).eq('id', existingShip.id)
      : await admin.from('order_shipments').insert(shipRow)

    if (upsertErr) {
      errors.push(`Gagal simpan tracking untuk ${order_number}: ${upsertErr.message}`)
      continue
    }

    // Advance order ke 'delivering' kalau masih confirmed/preparing
    if (order.status === 'confirmed' || order.status === 'preparing') {
      await admin
        .from('orders')
        .update({ status: 'delivering', delivering_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', order.id)
    }

    // Notify customer — WhatsApp + Push + Email (fire, ditunggu di hujung)
    const userId = order.user_id as string | null
    const orderId = order.id as string
    const orderNo = order.order_number as string
    const carrierName = carrier.name ?? carrier_id
    notifs.push((async () => {
      const { data: cust } = userId
        ? await admin.from('profiles').select('full_name, phone, email').eq('id', userId).single()
        : { data: null }
      const name = cust?.full_name ?? 'Pelanggan'

      if (cust?.phone) {
        const trackingLine = tracking_url
          ? `🔗 *Link Penghantaran:*\n${tracking_url}`
          : `📦 *No. Tracking:* ${tn}`
        const msg = [
          `🚚 *Pesanan ${orderNo} Dalam Penghantaran!*`,
          ``,
          `Hai ${name}, pesanan anda sedang dalam perjalanan.`,
          ``,
          trackingLine,
          ``,
          `_SyababFresh — Buah Segar Setiap Hari_ 🌿`,
        ].join('\n')
        await sendWhatsApp(cust.phone, msg).catch(() => {})
      }

      await sendUserPush(userId, {
        title: 'Dalam Penghantaran 🚚',
        body: `Pesanan ${orderNo} sedang dalam perjalanan ke alamat anda.`,
        url: `/orders/${orderId}`,
      }).catch(() => {})

      if (cust?.email) {
        await sendTrackingEmail({
          to: cust.email,
          customerName: name,
          orderNumber: orderNo,
          orderId,
          carrierName,
          trackingNumber: tn,
          trackingUrl: tracking_url,
          estimatedDelivery: null,
        }).catch(() => {})
      }
    })().catch(() => {}))

    ok++
  }

  await Promise.allSettled(notifs)
  return NextResponse.json({ ok, fail: errors.length, errors })
}
