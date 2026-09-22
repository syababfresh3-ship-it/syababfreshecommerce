import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendTrackingEmail } from '@/lib/zeptomail'
import { sendUserPush } from '@/lib/push'
import { syncTrackingToOps, describeOpsTracking, type OpsTrackingResult } from '@/lib/ops-tracking-sync'

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
  // WhatsApp TIDAK dihantar dari storefront (dasar 23 Sep 2026: tracking/POD = WA Official
  // dari ops app sahaja, Murpati tidak dipakai lagi). Tracking dihantar ke ops di hujung
  // fail; ops yang hantar WA. Nombor sahaja — link Lalamove (tiada no. tracking) tak
  // dihantar; ops ada flow Lalamove sendiri. Email + Push storefront kekal serta-merta.
  const opsItems: { orderNumber: string; trackingNo: string }[] = []

  // Push + Email serta-merta untuk satu order (storefront ATAU LP).
  // Contact (name/email/userId) sudah diselesaikan oleh pemanggil.
  async function sendNotifications(c: {
    userId: string | null
    name: string
    email: string | null
    orderNo: string
    orderId: string
    carrierName: string
    tn: string | null
    tracking_url: string | null
    pushUrl: string
  }) {
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
        .select('id, tracking_number, tracking_url')
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

      if (tn) opsItems.push({ orderNumber: on, trackingNo: tn })
      // Re-import nilai SAMA pada order yang dah 'delivering' → tiada apa baru untuk
      // dimaklumkan; langkau email/push/WA (elak customer terima mesej berulang).
      const sfUnchanged = !!existingShip && existingShip.tracking_number === tn
        && existingShip.tracking_url === tracking_url && order.status === 'delivering'

      const userId = order.user_id as string | null
      const orderId = order.id as string
      const orderNo = order.order_number as string
      if (!sfUnchanged) notifs.push((async () => {
        const { data: cust } = userId
          ? await admin.from('profiles').select('full_name, email').eq('id', userId).single()
          : { data: null }
        await sendNotifications({
          userId,
          name: cust?.full_name ?? 'Pelanggan',
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
      .select('id, status, order_number, user_id, name, email, tracking_number, tracking_url')
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
        ...(advance ? { status: 'delivering', delivering_at: now } : {}),
        updated_at: now,
      })
      .eq('id', lp.id)

    if (lpErr) {
      errors.push(`Gagal simpan tracking untuk ${on}: ${lpErr.message}`)
      continue
    }

    if (tn) opsItems.push({ orderNumber: on, trackingNo: tn })
    // Sama seperti storefront: re-import nilai sama pada order 'delivering' → senyap.
    const lpUnchanged = lp.tracking_number === tn && lp.tracking_url === tracking_url && lp.status === 'delivering'

    if (!lpUnchanged) notifs.push(sendNotifications({
      userId: (lp.user_id as string | null) ?? null,
      name: lp.name ?? 'Pelanggan',
      email: lp.email ?? null,
      orderNo: lp.order_number as string,
      orderId: lp.id as string,
      carrierName, tn, tracking_url,
      pushUrl: '/orders',
    }).catch(() => {}))

    ok++
  }

  await Promise.allSettled(notifs)

  // ── WhatsApp: ops app SAHAJA (WA Official) — satu sumber, tiada double ────────────
  // Tracking dihantar ke ops (manage.syababfresh.my); ops yang hantar WA customer
  // (idempotent di sana — re-import tak ulang WA). Storefront tak hantar WA sendiri
  // untuk apa-apa keadaan; kalau ops tak dapat dihubungi / order tiada di ops, admin
  // nampak amaran dan perlu import di ops. Lihat src/lib/ops-tracking-sync.ts.
  const ops: OpsTrackingResult | null = opsItems.length ? await syncTrackingToOps(opsItems) : null
  const wa = describeOpsTracking(ops)
  // waQueued kekal untuk keserasian UI lama — sentiasa 0 (Murpati tidak dipakai lagi).
  return NextResponse.json({ ok, fail: errors.length, errors, waQueued: 0, wa })
}
