import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { enqueueWhatsApp, type WaOutboxItem } from '@/lib/wa-outbox'
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
  // WhatsApp TIDAK dihantar terus — di-enqueue ke wa_outbox & dipacing oleh
  // cron drainer (elak ban gateway tak rasmi). Email + Push tetap serta-merta.
  const waQueue: WaOutboxItem[] = []

  // Push + Email serta-merta; WhatsApp di-enqueue (bukan dihantar) untuk satu order
  // (storefront ATAU LP). Contact (name/phone/email/userId) sudah diselesaikan oleh pemanggil.
  async function sendNotifications(c: {
    userId: string | null
    name: string
    phone: string | null
    email: string | null
    orderNo: string
    orderId: string
    carrierName: string
    tn: string | null
    tracking_url: string | null
    pushUrl: string
  }) {
    if (c.phone) {
      const trackingLine = c.tracking_url
        ? `🔗 *Link Penghantaran:*\n${c.tracking_url}`
        : `📦 *No. Tracking:* ${c.tn}`
      const msg = [
        `🚚 *Pesanan ${c.orderNo} Dalam Penghantaran!*`,
        ``,
        `Hai ${c.name}, pesanan anda sedang dalam perjalanan.`,
        ``,
        trackingLine,
        ``,
        `_SyababFresh — Buah Segar Setiap Hari_ 🌿`,
      ].join('\n')
      waQueue.push({ phone: c.phone, message: msg, orderId: c.orderId, source: 'tracking' })
    }

    await sendUserPush(c.userId, {
      title: 'Dalam Penghantaran 🚚',
      body: `Pesanan ${c.orderNo} sedang dalam perjalanan ke alamat anda.`,
      url: c.pushUrl,
    }).catch(() => {})

    if (c.email) {
      await sendTrackingEmail({
        to: c.email,
        customerName: c.name,
        orderNumber: c.orderNo,
        orderId: c.orderId,
        carrierName: c.carrierName,
        trackingNumber: c.tn ?? '',
        trackingUrl: c.tracking_url,
        estimatedDelivery: null,
      }).catch(() => {})
    }
  }

  for (const row of rows) {
    const order_number = row.order_number
    const tracking_number = row.tracking_number
    const carrier_id = row.carrier_id || 'ninja_cold'
    if (!order_number || !tracking_number) {
      errors.push(`Baris tidak lengkap: ${order_number ?? '?'} — ${tracking_number ?? '?'}`)
      continue
    }

    const on = order_number.trim()
    const raw = tracking_number.trim()
    const carrier = await getCarrier(carrier_id)
    const carrierName = carrier.name ?? carrier_id
    const now = new Date().toISOString()

    // Tentukan no tracking vs link penghantaran:
    //  • Carrier ada template (Ninja/Poslaju) → nilai = nombor; link dijana dari template.
    //  • Tiada template tapi nilai ialah URL (cth Lalamove bagi link share, bukan nombor)
    //    → simpan terus sebagai link; no tracking dibiar kosong.
    //  • Selainnya → simpan nombor sahaja.
    const isUrl = /^https?:\/\//i.test(raw)
    let tn: string | null
    let tracking_url: string | null
    if (carrier.template) {
      tn = raw
      tracking_url = carrier.template.replace('{number}', raw)
    } else if (isUrl) {
      tn = null
      tracking_url = raw
    } else {
      tn = raw
      tracking_url = null
    }

    // Cari order storefront dahulu
    const { data: order } = await admin
      .from('orders')
      .select('id, status, order_number, user_id')
      .eq('order_number', on)
      .single()

    if (order) {
      // ── Storefront order — tracking dalam order_shipments ──────────────────
      const shipRow = {
        order_id: order.id,
        carrier_id,
        tracking_number: tn,
        tracking_url,
        status: 'in_transit',
        shipped_at: now,
        updated_at: now,
      }
      // Upsert PRIMARY shipment (refund_id is null) — biarkan shipment ganti (refund) sendiri
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
        errors.push(`Gagal simpan tracking untuk ${on}: ${upsertErr.message}`)
        continue
      }

      // Advance order ke 'delivering' kalau masih confirmed/preparing
      if (order.status === 'confirmed' || order.status === 'preparing') {
        await admin
          .from('orders')
          .update({ status: 'delivering', delivering_at: now, updated_at: now })
          .eq('id', order.id)
      }

      const userId = order.user_id as string | null
      const orderId = order.id as string
      const orderNo = order.order_number as string
      notifs.push((async () => {
        const { data: cust } = userId
          ? await admin.from('profiles').select('full_name, phone, email').eq('id', userId).single()
          : { data: null }
        await sendNotifications({
          userId,
          name: cust?.full_name ?? 'Pelanggan',
          phone: cust?.phone ?? null,
          email: cust?.email ?? null,
          orderNo, orderId, carrierName, tn, tracking_url,
          pushUrl: `/orders/${orderId}`,
        })
      })().catch(() => {}))

      ok++
      continue
    }

    // ── LP guest order — tracking disimpan terus pada lp_guest_orders ─────────
    const { data: lp } = await admin
      .from('lp_guest_orders')
      .select('id, status, order_number, user_id, name, phone, email')
      .eq('order_number', on)
      .single()

    if (!lp) {
      errors.push(`Pesanan tidak dijumpai: ${order_number}`)
      continue
    }

    const advance = lp.status === 'confirmed' || lp.status === 'preparing'
    const { error: lpErr } = await admin
      .from('lp_guest_orders')
      .update({
        courier_id: carrier_id,
        tracking_number: tn,
        tracking_url,
        ...(advance ? { status: 'delivering' } : {}),
        updated_at: now,
      })
      .eq('id', lp.id)

    if (lpErr) {
      errors.push(`Gagal simpan tracking untuk ${on}: ${lpErr.message}`)
      continue
    }

    notifs.push(sendNotifications({
      userId: (lp.user_id as string | null) ?? null,
      name: lp.name ?? 'Pelanggan',
      phone: lp.phone ?? null,
      email: lp.email ?? null,
      orderNo: lp.order_number as string,
      orderId: lp.id as string,
      carrierName, tn, tracking_url,
      pushUrl: '/orders',
    }).catch(() => {}))

    ok++
  }

  await Promise.allSettled(notifs)
  // Enqueue semua WA sekali gus dgn jadual berperingkat (dipacing oleh drainer)
  const queued = await enqueueWhatsApp(waQueue)
  return NextResponse.json({ ok, fail: errors.length, errors, waQueued: queued })
}
