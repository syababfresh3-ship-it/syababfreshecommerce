import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/murpati'
import { sendAdminPush } from '@/lib/push'
import { sendPaymentConfirmedEmail } from '@/lib/zeptomail'
import { sendCapiPurchaseWhatsApp } from '@/lib/meta-capi'

// CHIP's RSA public key may be stored as a single line (no newlines) in the
// environment — Node's crypto.verify needs a properly wrapped PEM. Rebuild it.
export function normalizeChipPem(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.replace(/\\n/g, '\n').trim()
  if (s.includes('\n')) return s // already multi-line
  const m = s.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*)-----END \1-----/)
  if (!m) return s
  const label = m[1].trim()
  const body = m[2].replace(/\s+/g, '')
  const lines = body.match(/.{1,64}/g)?.join('\n') ?? body
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`
}

type ConfirmResult = 'confirmed' | 'already' | 'notfound'

// Flip an LP guest order pending → confirmed/paid (idempotent: only the caller
// that wins the pending→confirmed transition runs promo/points/notifications).
// Single source of truth shared by the CHIP webhook, the browser verify-payment
// fallback, and the reconciliation cron.
export async function confirmLpGuestOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ConfirmResult> {
  const { data: lp } = await supabase
    .from('lp_guest_orders')
    .update({ status: 'confirmed', payment_status: 'paid' })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id, order_number, name, phone, total, items, payment_method, promo_code_id, user_id, points_used, email, address, ctwa_clid, landing_pages(title)')
    .maybeSingle()

  if (!lp) return 'already' // already processed, or id not an LP order

  const order = lp as any

  // Promo uses naik bila bayaran FPX disahkan (COD dikira masa buat order)
  if (order.promo_code_id) {
    await supabase.rpc('increment_promo_uses', { promo_id: order.promo_code_id })
  }
  // Tolak mata ditebus (FPX) — guard flip pending→confirmed pastikan sekali sahaja
  if (order.points_used > 0 && order.user_id) {
    await supabase.from('loyalty_transactions').insert({
      user_id: order.user_id, order_id: null, points: -order.points_used, type: 'redeem',
      description: `Redeem ${order.points_used} mata untuk LP ${order.order_number}`,
    })
    await supabase.rpc('increment_points', { uid: order.user_id, pts: -order.points_used })
  }

  // Loyalty points are earned on delivery (see landing-pages orders PATCH → 'delivered')
  const lpTitle = order.landing_pages?.title ?? 'SyababFresh'
  const itemLines = ((order.items as any[]) ?? [])
    .map((i: any) => `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} × ${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`)
    .join('\n')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

  // Nota: WhatsApp ke customer untuk pengesahan bayaran DIBUANG — guna email sahaja
  // (kurangkan risiko ban WA tidak rasmi). WA ke customer kini hanya untuk tracking.

  // Email pengesahan bayaran (email kini wajib masa order)
  if (order.email) {
    sendPaymentConfirmedEmail({
      to: order.email,
      customerName: order.name,
      orderNumber: order.order_number,
      items: ((order.items as any[]) ?? []).map((i: any) => ({ name: i.product_name, quantity: i.quantity, unit_price: Number(i.unit_price), variant_name: i.variant_name ?? null })),
      total: Number(order.total),
      deliveryAddress: order.address ?? null,
      deliverySlot: null,
      notes: null,
      receiptUrl: `${appUrl}/resit/${order.id}`,
    }).catch(() => {})
  }

  // WhatsApp + push to admin
  const adminPhone = process.env.ADMIN_WHATSAPP
  if (adminPhone) {
    sendWhatsApp(adminPhone, [
      `🛒 *Pesanan LP Baru — ${order.order_number}*`,
      ``,
      `👤 *Pelanggan:* ${order.name}`,
      `📱 *Telefon:* ${order.phone}`,
      `🛍️ ${lpTitle}`,
      ``,
      itemLines,
      ``,
      `💰 *Jumlah:* RM${Number(order.total).toFixed(2)}`,
      `💳 *Bayaran:* FPX ✅ Dibayar`,
    ].join('\n')).catch(() => {})
    sendAdminPush({
      title: `💳 LP FPX Dibayar — ${order.order_number}`,
      body: `${order.name} · RM${Number(order.total).toFixed(2)}`,
      url: '/admin/fulfillment',
      tag: 'payment-confirmed',
    }).catch(() => {})
  }

  // CTWA conversion — order FPX dari iklan Click-to-WhatsApp baru sahaja dibayar.
  // Hantar Purchase ke Meta. Race-safe (flip guard) + dedup event_id. Fire-and-forget.
  if (order.ctwa_clid) {
    void sendCapiPurchaseWhatsApp({
      orderId: order.id,
      orderNumber: order.order_number,
      total: Number(order.total),
      phone: order.phone,
      ctwa_clid: order.ctwa_clid,
    }).catch(() => {})
  }

  return 'confirmed'
}

// Flip a storefront order pending/unpaid → confirmed/paid (idempotent). Mirrors
// the LP helper. Loyalty earn/spend is awarded on delivery, not here.
export async function confirmStorefrontOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ConfirmResult> {
  const { data: updated } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('payment_status', 'unpaid')
    .select(`
      id, user_id, total, order_number, payment_method,
      delivery_address, delivery_slot, notes, points_used, promo_code_id,
      order_items(product_id, variant_id, product_name, quantity, unit_price, variant_name)
    `)
    .maybeSingle()

  if (!updated) return 'already'

  const {
    user_id, total, order_number, payment_method, delivery_address, delivery_slot, notes,
    points_used, promo_code_id, order_items,
  } = updated as any

  // `profiles` has no direct FK to `orders`, so PostgREST can't embed it in the
  // UPDATE … RETURNING above — including it errors the whole statement (PGRST200)
  // and the paid/confirmed flip never persists. Fetch the profile separately.
  const { data: profiles } = user_id
    ? await supabase
        .from('profiles')
        .select('full_name, phone, email, loyalty_tiers(multiplier)')
        .eq('id', user_id)
        .maybeSingle()
    : { data: null }

  // Deduct inventory per item — variant items use deduct_variant_stock, others FIFO batches
  const deductResults = await Promise.all(
    (order_items ?? []).map((item: any) =>
      item.variant_id
        ? supabase.rpc('deduct_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity })
        : supabase.rpc('deduct_inventory', { p_product_id: item.product_id, p_quantity: item.quantity })
    )
  )

  const oversoldItems = (order_items ?? []).filter((_: any, i: number) => deductResults[i].error)
  if (oversoldItems.length > 0) {
    const names = oversoldItems.map((i: any) => i.product_name).join(', ')
    await supabase
      .from('orders')
      .update({ admin_notes: `⚠️ STOK TIDAK MENCUKUPI: ${names}. Hubungi pelanggan.` })
      .eq('id', orderId)
    const adminPhone = process.env.ADMIN_WHATSAPP
    if (adminPhone) {
      sendWhatsApp(adminPhone, [
        `🚨 *STOK TIDAK MENCUKUPI — Tindakan Diperlukan*`,
        ``,
        `Pesanan *${order_number}* telah dibayar (RM${Number(total).toFixed(2)}) tetapi stok tidak mencukupi:`,
        ...oversoldItems.map((i: any) => `• ${i.product_name}`),
        ``,
        `Sila hubungi pelanggan: *${profiles?.full_name ?? '—'}* (${profiles?.phone ?? '—'})`,
        `untuk maklumkan kelewatan / tawaran penggantian.`,
      ].join('\n')).catch(() => {})
    }
  }

  // Deduct loyalty points used (safe now that payment confirmed)
  if (points_used > 0) {
    await supabase.from('loyalty_transactions').insert({
      user_id, order_id: orderId, points: -points_used, type: 'redeem',
      description: `Redeem ${points_used} mata untuk ${order_number}`,
    })
    await supabase.rpc('increment_points', { uid: user_id, pts: -points_used })
  }

  if (promo_code_id) {
    await supabase.rpc('increment_promo_uses', { promo_id: promo_code_id })
  }

  const customerEmail = profiles?.email
  if (customerEmail) {
    sendPaymentConfirmedEmail({
      to: customerEmail,
      customerName: profiles?.full_name ?? 'Pelanggan',
      orderNumber: order_number,
      items: (order_items ?? []).map((i: any) => ({ name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, variant_name: i.variant_name ?? null })),
      total: Number(total),
      deliveryAddress: delivery_address ?? null,
      deliverySlot: delivery_slot ?? null,
      notes: notes ?? null,
      receiptUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'}/resit/${orderId}`,
    }).catch(err => console.error('[confirm-order] email error:', err))
  }

  const adminPhone = process.env.ADMIN_WHATSAPP
  if (adminPhone) {
    const paymentLabel: Record<string, string> = {
      fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Pindahan Bank',
    }
    const itemLines = (order_items ?? [])
      .map((i: any) => `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} x${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`)
      .join('\n')
    const stockWarning = oversoldItems.length > 0
      ? `\n\n⚠️ *STOK TIDAK MENCUKUPI:* ${oversoldItems.map((i: any) => i.product_name).join(', ')}`
      : ''
    sendWhatsApp(adminPhone, [
      `🛒 *Pesanan Baru — ${order_number}*`,
      ``,
      `👤 *Pelanggan:* ${profiles?.full_name ?? '—'}`,
      `📱 *Telefon:* ${profiles?.phone ?? '—'}`,
      ``,
      `🧺 *Item:*`,
      itemLines,
      ``,
      `💰 *Jumlah:* RM${Number(total).toFixed(2)}`,
      `💳 *Bayaran:* ${paymentLabel[payment_method] ?? payment_method} ✅ Dibayar`,
      ``,
      `📍 *Alamat:*`,
      delivery_address ?? '—',
      notes ? `\n📝 *Nota:* ${notes}` : '',
      stockWarning,
    ].filter(Boolean).join('\n')).catch(() => {})
  }

  sendAdminPush({
    title: `💳 FPX Dibayar — ${order_number}`,
    body: `${profiles?.full_name ?? 'Pelanggan'} · RM${Number(total).toFixed(2)}`,
    url: '/admin/fulfillment',
    tag: 'payment-confirmed',
  }).catch(() => {})

  return 'confirmed'
}
