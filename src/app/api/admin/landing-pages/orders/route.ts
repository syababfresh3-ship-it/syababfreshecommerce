import { requireAdmin } from '@/lib/supabase/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardLpLoyalty } from '@/lib/lp-loyalty'
import { reverseLpLoyalty } from '@/lib/loyalty-reverse'
import { restoreLpOrderStock } from '@/lib/stock'
import { sendLpReviewRequest } from '@/lib/order-delivered'
import { deductLpOrderStock } from '@/lib/stock'
import { sendOrderConfirmationEmail } from '@/lib/zeptomail'
import { canTransition, transitionError } from '@/lib/order-status'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const url = new URL(request.url)
  const pageId = url.searchParams.get('page_id')
  const status = url.searchParams.get('status')

  const BASE = 'id, order_number, name, phone, address, postcode, product_name, variant_name, quantity, unit_price, delivery_fee, total, payment_method, payment_status, status, notes, source, created_at, landing_pages(title, slug)'

  const run = (cols: string) => {
    let q = supabase!
      .from('lp_guest_orders')
      .select(cols)
      .order('created_at', { ascending: false })
      .limit(100)
    if (pageId) q = q.eq('page_id', pageId)
    if (status) q = q.eq('status', status)
    else q = q.not('status', 'in', '(delivered,cancelled,refunded)')
    return q
  }

  // needs_approval hanya wujud selepas migration 132 — jatuh balik bila tiada.
  let { data, error } = await run(`${BASE}, needs_approval`)
  if (error && ['42703', 'PGRST204'].includes(error.code ?? '')) {
    ;({ data, error } = await run(BASE))
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hide unpaid online (FPX/e-wallet) orders — customer opened the payment page but
  // never completed payment. COD/bank orders always show.
  const visible = (data ?? []).filter((o: any) =>
    ['fpx', 'ewallet'].includes(o.payment_method) ? o.payment_status === 'paid' : true
  )
  return NextResponse.json(visible)
}

export async function PATCH(request: Request) {
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const { id, action, status, payment_status, name, phone, address, postcode, notes, courier_id, tracking_number, tracking_url, shipment_notes, delivery_fee } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // ── Kelulusan COD dari LP (migration 132) ─────────────────────────
  // Order COD masuk sebagai menunggu kelulusan: stok, mata, kiraan promo dan
  // e-mel pengesahan semuanya DITANGGUH sampai di sini. Tolak = tiada apa yang
  // perlu dipulangkan kerana tiada apa yang pernah ditolak.
  if (action === 'approve' || action === 'reject') {
    const { data: o, error: loadErr } = await supabase!
      .from('lp_guest_orders')
      .select('*')
      .eq('id', id)
      .single()
    if (loadErr || !o) return NextResponse.json({ error: 'Pesanan tidak dijumpai' }, { status: 404 })
    if (!o.needs_approval) return NextResponse.json({ error: 'Pesanan tidak memerlukan kelulusan' }, { status: 400 })

    if (action === 'reject') {
      const { error } = await supabase!.from('lp_guest_orders').update({
        status: 'cancelled',
        needs_approval: false,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, action: 'reject' })
    }

    // Lulus: potong stok dahulu — kalau tak cukup, beritahu admin tapi teruskan
    // (sama dengan kelakuan kelulusan order ahli; admin hubungi pelanggan).
    const stockResult = await deductLpOrderStock(supabase!, id)

    if (o.promo_code_id) {
      await supabase!.rpc('increment_promo_uses', { promo_id: o.promo_code_id })
    }
    if (Number(o.points_used) > 0 && o.user_id) {
      await supabase!.from('loyalty_transactions').insert({
        user_id: o.user_id, order_id: null, points: -Number(o.points_used), type: 'redeem',
        description: `Redeem ${o.points_used} mata untuk LP ${o.order_number}`,
      })
      await supabase!.rpc('increment_points', { uid: o.user_id, pts: -Number(o.points_used) })
    }

    const { error } = await supabase!.from('lp_guest_orders').update({
      status: 'confirmed',
      needs_approval: false,
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // E-mel pengesahan hanya sekarang — pelanggan tidak dapat pengesahan untuk
    // order yang belum diluluskan.
    if (o.email) {
      const items = Array.isArray(o.items) && o.items.length > 0
        ? (o.items as { product_name: string; quantity: number; unit_price: number; variant_name?: string | null }[])
        : [{ product_name: o.product_name, quantity: o.quantity, unit_price: Number(o.unit_price), variant_name: o.variant_name }]
      sendOrderConfirmationEmail({
        to: o.email,
        customerName: o.name,
        orderNumber: o.order_number,
        items: items.map(i => ({ name: i.product_name, quantity: i.quantity, unit_price: Number(i.unit_price), variant_name: i.variant_name ?? null })),
        total: Number(o.total),
        deliveryAddress: o.address,
        deliverySlot: null,
        paymentMethod: o.payment_method,
        notes: o.notes ?? null,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, action: 'approve', stock: stockResult })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Status update
  let prevStatus: string | null = null
  if (status !== undefined) {
    const VALID = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled', 'refunded']
    if (!VALID.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    // Audit §4: peraturan peralihan status
    const { data: cur } = await supabase!.from('lp_guest_orders').select('status').eq('id', id).single()
    prevStatus = cur?.status ?? null
    if (!canTransition(prevStatus, status)) return NextResponse.json({ error: transitionError(prevStatus, status) }, { status: 409 })
    update.status = status
    // Cap masa transisi penghantaran (dipakai cron auto-deliver)
    if (status === 'delivering') update.delivering_at = update.updated_at
    if (status === 'delivered')  update.delivered_at  = update.updated_at
  }

  // Payment status update (manual confirm COD/bank, atau tanda belum bayar)
  if (payment_status !== undefined) {
    const VALID_PAY = ['unpaid', 'paid', 'refunded', 'failed']
    if (!VALID_PAY.includes(payment_status)) return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
    update.payment_status = payment_status
  }

  // Customer details update
  if (name !== undefined) update.name = String(name).trim()
  if (phone !== undefined) update.phone = String(phone).trim()
  if (address !== undefined) update.address = String(address).trim()
  if (postcode !== undefined) update.postcode = postcode ? String(postcode).trim() : null
  if (notes !== undefined) update.notes = notes ? String(notes).trim() : null
  if (courier_id !== undefined) update.courier_id = courier_id || null
  if (tracking_number !== undefined) update.tracking_number = tracking_number || null
  if (tracking_url !== undefined) update.tracking_url = tracking_url || null
  if (shipment_notes !== undefined) update.shipment_notes = shipment_notes || null

  // Kos penghantaran — reseller (B2B) sahaja, dirunding. Kira semula total dari item.
  if (delivery_fee !== undefined) {
    const fee = Number(delivery_fee)
    if (!Number.isFinite(fee) || fee < 0) return NextResponse.json({ error: 'Kos penghantaran tidak sah' }, { status: 400 })
    const { data: ord } = await supabase!
      .from('lp_guest_orders')
      .select('source, items, discount, points_discount')
      .eq('id', id)
      .single()
    if (!ord) return NextResponse.json({ error: 'Order tidak dijumpai' }, { status: 404 })
    if (ord.source !== 'reseller') return NextResponse.json({ error: 'Kos penghantaran hanya boleh diubah untuk order reseller' }, { status: 400 })
    const items: any[] = Array.isArray(ord.items) ? ord.items : []
    const subtotal = items.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 0), 0)
    update.delivery_fee = fee
    update.total = Math.max(0, subtotal + fee - Number(ord.discount || 0) - Number(ord.points_discount || 0))
  }

  const { error } = await supabase!
    .from('lp_guest_orders')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Loyalty side-effects on terminal status changes (use service role for the RPCs)
  if (status === 'delivered' || status === 'refunded' || status === 'cancelled') {
    const admin = createAdminClient()
    const { data: lp } = await admin
      .from('lp_guest_orders')
      .select('id, order_number, phone, total, payment_method, payment_status, user_id, source')
      .eq('id', id)
      .single()
    if (lp) {
      // Delivered (payment received, incl. COD/bank) → award (user_id, atau match telefon).
      // Refunded/cancelled → reverse earned + redeemed (mata ditebus dipulang). Semua idempotent.
      if (status === 'delivered') { await awardLpLoyalty(admin, lp).catch(() => {}); await sendLpReviewRequest(admin, id).catch(() => {}) }
      else await reverseLpLoyalty(admin, lp).catch(() => {})
    }
    // Audit §4/§0.7: cancel pulangkan stok yang dipotong (sekali sahaja, stock_restored_at)
    if (status === 'cancelled' && prevStatus !== 'cancelled') await restoreLpOrderStock(admin, id)
  }

  return NextResponse.json({ ok: true })
}
