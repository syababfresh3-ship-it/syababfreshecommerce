import type { SupabaseClient } from '@supabase/supabase-js'
import { reviewUrl } from '@/lib/review-token'
import { sendWhatsApp } from '@/lib/murpati'
import { awardOrderLoyalty } from '@/lib/loyalty-award'
import { sendReviewRequestEmail } from '@/lib/zeptomail'
import { getAppSettings } from '@/lib/app-settings'

// An order counts as "settled" — and therefore eligible to earn loyalty — when:
//   - it was paid online (payment_status === 'paid'), OR
//   - it is COD / bank_transfer, where money changes hands on delivery itself
//     (those orders stay payment_status='unpaid' but delivery means cash received).
// Online methods (fpx / ewallet) that are still unpaid never earn points.
export function isOrderSettled(payment_method: string | null, payment_status: string | null): boolean {
  if (payment_status === 'paid') return true
  return payment_method === 'cod' || payment_method === 'bank_transfer'
}

async function processReferralReward(supabase: SupabaseClient, userId: string, orderId: string) {
  const { data: referral } = await supabase
    .from('referrals')
    .select('id, referrer_id, referrer_pts')
    .eq('referee_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!referral) return

  // Award referrer
  await supabase.from('loyalty_transactions').insert({
    user_id: referral.referrer_id,
    points: referral.referrer_pts,
    type: 'earn',
    description: 'Ganjaran rujukan — rakan anda buat pesanan pertama!',
  })
  await supabase.rpc('increment_points', { uid: referral.referrer_id, pts: referral.referrer_pts })

  // Mark referral rewarded
  await supabase
    .from('referrals')
    .update({ status: 'rewarded', order_id: orderId, rewarded_at: new Date().toISOString() })
    .eq('id', referral.id)

  // Notify referrer via WhatsApp
  const [referrerRes, refereeRes] = await Promise.all([
    supabase.from('profiles').select('phone').eq('id', referral.referrer_id).single(),
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
  ])
  if (referrerRes.data?.phone) {
    const refereeName = refereeRes.data?.full_name ?? 'Rakan anda'
    sendWhatsApp(referrerRes.data.phone, [
      `🎉 *Tahniah! Ganjaran Rujukan Diterima*`,
      ``,
      `*${refereeName}* baru sahaja selesai buat pesanan pertama guna kod rujukan anda!`,
      ``,
      `✨ *+${referral.referrer_pts} mata* telah dikreditkan ke akaun anda.`,
      ``,
      `Teruskan kongsi link rujukan untuk dapatkan lebih banyak ganjaran! 🍒`,
    ].join('\n')).catch(() => {})
  }
}

// Komisen affiliate PRODUK-LINK (migration 139 + 165). Baris 'pending' dicap masa order
// dicipta (lib/affiliate-stamp.ts). Bila order delivered+dibayar, fungsi ini TIDAK kredit
// serta-merta — ia JADUALKAN kredit (credit_after = now + affiliate_hold_days, lalai 7)
// melalui RPC affiliate_schedule_credit. Cron /api/cron/affiliate-credit yang kredit
// secara atomik selepas tempoh tahan, dengan semakan semula status order & affiliate.
// Idempotent. Panggil HANYA untuk order settled (di bawah gate isOrderSettled).
export async function creditAffiliateAttributions(
  supabase: SupabaseClient,
  orderId: string,
  orderSource: 'order' | 'lp_guest',
) {
  try {
    let holdDays = 7
    try {
      const s = await getAppSettings()
      const n = parseInt(s['affiliate_hold_days'] ?? '7', 10)
      if (Number.isFinite(n) && n >= 0 && n <= 60) holdDays = n
    } catch { /* guna lalai */ }
    const { error } = await supabase.rpc('affiliate_schedule_credit', {
      p_source: orderSource, p_order_id: orderId, p_hold_days: holdDays,
    })
    if (error) throw error
  } catch (err) {
    // RPC belum wujud (migration 165 belum jalan) atau ralat lain → senyap; cron tak akan kredit
    // sehingga migration dijalankan (baris kekal pending, tiada komisen hilang).
    console.error('[affiliate-credit] gagal jadualkan:', (err as Error)?.message)
  }
}

// Kredit komisen affiliate untuk order GUEST/LP (lp_guest_orders) bila delivered.
// Self-fetch status bayaran → hanya kredit jika settled. Idempotent. Panggil di
// SETIAP laluan yang tandakan lp_guest_orders 'delivered' (sebelah awardLpLoyalty).
// Migration 139.
export async function handleLpGuestDelivered(supabase: SupabaseClient, orderId: string) {
  try {
    const { data: o } = await supabase
      .from('lp_guest_orders')
      .select('source, payment_method, payment_status')
      .eq('id', orderId)
      .single()
    if (!o || o.source === 'reseller') return
    if (!isOrderSettled(o.payment_method, o.payment_status)) return
    await creditAffiliateAttributions(supabase, orderId, 'lp_guest')
  } catch (err) {
    console.error('[affiliate-credit-lp] gagal:', (err as Error)?.message)
  }
}

// Reversal komisen affiliate bila order REFUND / BATAL (migration 139 + 165). RPC atomik
// affiliate_reverse_order: baris 'credited' → tolak balik baki → 'reversed'; baris 'pending'
// (belum/menunggu tempoh tahan) → 'reversed' tanpa sentuh baki. Idempotent.
// Panggil dari handler refund & cancel (member & guest/LP); cron juga menyapu pending
// yang ordernya dibatalkan melalui laluan lain (CHIP gagal, pelanggan batal).
export async function reverseAffiliateAttributions(
  supabase: SupabaseClient,
  orderId: string,
  orderSource: 'order' | 'lp_guest',
  reason: 'refunded' | 'cancelled' = 'refunded',
) {
  try {
    const { error } = await supabase.rpc('affiliate_reverse_order', {
      p_source: orderSource, p_order_id: orderId, p_reason: reason,
    })
    if (error) throw error
  } catch (err) {
    console.error('[affiliate-reverse] gagal:', (err as Error)?.message)
  }
}

// Single source of truth for everything that must happen when a regular order
// reaches 'delivered'. Call this from EVERY path that transitions an order to
// 'delivered' (admin orders PATCH, shipping module, …) so behaviour stays
// consistent. Every side-effect is idempotent, so repeat calls are safe.
//
// Pass a service-role client (createAdminClient) — the loyalty/affiliate RPCs and
// cross-user inserts require it.
export async function handleOrderDelivered(supabase: SupabaseClient, orderId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('user_id, total, order_number, payment_method, payment_status')
    .eq('id', orderId)
    .single()
  if (!order) return

  // Earn points + affiliate commission — but only for settled orders (don't reward
  // unpaid online orders). Komisen affiliate = produk-link (migration 139).
  if (isOrderSettled(order.payment_method, order.payment_status)) {
    await awardOrderLoyalty(supabase, {
      id: orderId,
      user_id: order.user_id,
      order_number: order.order_number,
      total: order.total,
    })
    await creditAffiliateAttributions(supabase, orderId, 'order')
  }
  await processReferralReward(supabase, order.user_id, orderId)
  await sendReviewRequest(supabase, order.user_id, orderId, order.order_number)
}

// Email jemput ulasan — sekali per order (review_request_sent_at). Best-effort:
// gagal email tak patut gagalkan transisi delivered.
async function sendReviewRequest(
  supabase: SupabaseClient,
  userId: string | null,
  orderId: string,
  orderNumber: string,
) {
  try {
    if (!userId) return
    // Kunci dulu (idempotent) — hanya SATU panggilan menang; ulangan skip.
    const { data: claimed } = await supabase
      .from('orders')
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq('id', orderId)
      .is('review_request_sent_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) return

    const [{ data: prof }, { data: items }] = await Promise.all([
      supabase.from('profiles').select('email, full_name').eq('id', userId).maybeSingle(),
      supabase.from('order_items').select('product_name, products(slug)').eq('order_id', orderId),
    ])
    if (!prof?.email) return

    await sendReviewRequestEmail({
      to: prof.email,
      customerName: prof.full_name ?? 'Pelanggan',
      orderNumber,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: (items ?? []).map((i: any) => ({ name: i.product_name, slug: i.products?.slug ?? null })),
      reviewUrl: reviewUrl('storefront', orderId),
    })
  } catch (err) {
    console.error('[order-delivered] review request email error:', err)
  }
}

// Sprint 3D: jemput ulasan untuk order LP/tetamu (dulu tiada langsung). Perlu email
// pada order (TikTok/Quick Order tanpa email → skip). Sekali per order
// (lp_guest_orders.review_request_sent_at, migration 126; tahan-ralat kalau belum ada).
export async function sendLpReviewRequest(supabase: SupabaseClient, lpOrderId: string) {
  try {
    const { data: claimed, error } = await supabase
      .from('lp_guest_orders')
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq('id', lpOrderId)
      .is('review_request_sent_at', null)
      .select('id, order_number, name, email, items')
    if (error || !claimed || claimed.length === 0) return
    const o = claimed[0]
    if (!o.email) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = ((o.items as any[]) ?? []).filter(i => i?.product_id)
    const ids = [...new Set(raw.map(i => i.product_id as string))]
    const { data: prods } = ids.length ? await supabase.from('products').select('id, slug').in('id', ids) : { data: [] }
    const slugById = new Map((prods ?? []).map(p => [p.id, p.slug]))
    await sendReviewRequestEmail({
      to: o.email,
      customerName: o.name ?? 'Pelanggan',
      orderNumber: o.order_number,
      items: raw.map(i => ({ name: i.product_name ?? 'Produk', slug: slugById.get(i.product_id) ?? null })),
      reviewUrl: reviewUrl('lp', lpOrderId),
    })
  } catch (err) {
    console.error('[order-delivered] LP review request email error:', err)
  }
}
