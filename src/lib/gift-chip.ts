import { createAdminClient } from '@/lib/supabase/admin'

// Pembina purchase CHIP untuk Gift Studio (deposit / baki). Cermin corak
// api/pay/[id] & lp order. reference = `gift:<id>:<kind>` supaya webhook kenal
// tempahan gift + jenis bayaran tanpa lajur tambahan. Lihat webhook/chip.

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit && !explicit.includes('localhost')) return explicit
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return explicit ?? 'http://localhost:3006'
}

export type GiftPayKind = 'deposit' | 'balance'

/** Cipta checkout CHIP untuk deposit/baki tempahan gift; simpan payment_ref. */
export async function createGiftCheckout(order: {
  id: string; order_number: string; name: string; phone: string; email?: string | null
}, kind: GiftPayKind, amountRM: number): Promise<{ url: string } | { error: string }> {
  if (!process.env.CHIP_SECRET_KEY || !process.env.CHIP_BRAND_ID) return { error: 'Payment gateway tidak dikonfigurasi' }
  if (!(amountRM > 0)) return { error: 'Jumlah tidak sah' }
  const base = appUrl()
  const label = kind === 'deposit' ? 'Deposit' : 'Baki'
  const res = await fetch(`${CHIP_API_URL}/purchases/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client: { email: order.email || `gift+${order.order_number}@syababfresh.my`, full_name: order.name, phone: order.phone },
      purchase: { currency: 'MYR', products: [{ name: `${label} — ${order.order_number}`, price: Math.round(amountRM * 100), quantity: 1 }], notes: order.order_number },
      brand_id: process.env.CHIP_BRAND_ID,
      reference: `gift:${order.id}:${kind}`,
      success_redirect: `${base}/kurma/berjaya/${order.order_number}`,
      failure_redirect: `${base}/kurma/berjaya/${order.order_number}?bayar=gagal`,
      cancel_redirect: `${base}/kurma/berjaya/${order.order_number}`,
      success_callback: `${base}/api/webhook/chip`,
      send_receipt: false,
    }),
  })
  if (!res.ok) { console.error('[gift-chip] CHIP error', res.status, await res.text().catch(() => '')); return { error: 'Gagal sambung payment gateway' } }
  const data = await res.json()
  if (!data?.checkout_url) return { error: 'Tiada checkout URL' }
  if (data.id) await createAdminClient().from('gift_orders').update({ payment_ref: data.id }).eq('id', order.id)
  return { url: data.checkout_url }
}
