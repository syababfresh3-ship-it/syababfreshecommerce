import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { getZone, extractPostcode } from '@/app/admin/lalamove-grouping/zone-config'
import * as XLSX from 'xlsx'

// GET /api/admin/lalamove-export
// Export order Lalamove (KV, belum dihantar) storefront + LP → Excel format TikTok Shop
// supaya boleh di-IMPORT terus ke syababfresh-app (parser Fresh). SEMENTARA — bridge
// sahaja. Tiada tulis/ubah data; pure read + jana fail.
//
// Lajur ikut parser Fresh syababfresh-app. PENTING: "Delivery Option" mesti ada
// "seller" (baris tanpa "seller" di-skip masa import); deliveryType=LALAMOVE auto
// dari Zipcode KV.

const CATEGORY = 'Syabab Storefront'   // kategori (untuk pilihan masa import)
const DELIVERY_OPTION = 'Shipped by Seller'

interface Row {
  'Order ID': string
  'Recipient': string
  'Phone #': string
  'Zipcode': string
  'Post Town': string
  'State': string
  'Detail Address': string
  'Additional address information': string
  'Product Category': string
  'Product Name': string
  'Variation': string
  'Quantity': number
  'Weight(kg)': number
  'Delivery Option': string
  'Order Amount': number
  'Buyer Message': string
}

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const admin = supabase!

  const since = new Date(); since.setDate(since.getDate() - 30)
  const sinceISO = since.toISOString()
  const rows: Row[] = []

  // Poskod 'Pos sahaja' — Lalamove tak sampai, jangan export
  const { data: ovRows } = await admin.from('delivery_zones').select('postcode').eq('courier_override', 'pos')
  const posOnly = new Set((ovRows ?? []).map((r) => r.postcode))

  // ── Storefront orders ─────────────────────────────────────────────────────
  const { data: sf } = await admin
    .from('orders')
    .select('id, order_number, total, delivery_address, notes, user_id, address_id')
    .in('status', ['confirmed', 'preparing'])
    .neq('delivery_method', 'pickup')
    .or('payment_status.eq.paid,payment_method.in.(cod,bank_transfer)')
    .gte('created_at', sinceISO)

  if (sf && sf.length) {
    const ids = sf.map((o) => o.id)
    const { data: shipped } = await admin.from('order_shipments').select('order_id').is('refund_id', null).in('order_id', ids)
    const shippedSet = new Set((shipped ?? []).map((s) => s.order_id))
    const pending = sf.filter((o) => !shippedSet.has(o.id))

    const userIds = [...new Set(pending.map((o) => o.user_id).filter(Boolean))]
    const addrIds = [...new Set(pending.map((o) => o.address_id).filter(Boolean))]
    const [{ data: profiles }, { data: addresses }, { data: items }] = await Promise.all([
      admin.from('profiles').select('id, full_name, phone').in('id', userIds.length ? userIds : ['—']),
      admin.from('addresses').select('id, postcode, city, state, recipient_name, recipient_phone').in('id', addrIds.length ? addrIds : ['—']),
      admin.from('order_items').select('order_id, product_name, quantity, variant_name').in('order_id', pending.map((o) => o.id)),
    ])
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const aMap = new Map((addresses ?? []).map((a) => [a.id, a]))
    const iMap = new Map<string, { product_name: string; quantity: number; variant_name: string | null }[]>()
    for (const it of items ?? []) { const a = iMap.get(it.order_id) ?? []; a.push(it); iMap.set(it.order_id, a) }

    for (const o of pending) {
      const prof = o.user_id ? pMap.get(o.user_id) : null
      const addr = o.address_id ? aMap.get(o.address_id) : null
      const postcode = addr?.postcode ?? extractPostcode(o.delivery_address) ?? ''
      if (!postcode || posOnly.has(postcode) || !getZone(postcode)) continue   // KV sahaja
      const its = iMap.get(o.id) ?? [{ product_name: '(item)', quantity: 1, variant_name: null }]
      for (const it of its) {
        rows.push(mkRow({
          orderId: o.order_number,
          recipient: addr?.recipient_name ?? prof?.full_name ?? '',
          phone: addr?.recipient_phone ?? prof?.phone ?? '',
          zipcode: postcode, postTown: addr?.city ?? '', state: addr?.state ?? '',
          address: o.delivery_address ?? '', total: Number(o.total) || 0, notes: o.notes ?? '',
          product: it.product_name, variation: it.variant_name ?? '', qty: it.quantity,
        }))
      }
    }
  }

  // ── LP guest orders ───────────────────────────────────────────────────────
  const { data: lp } = await admin
    .from('lp_guest_orders')
    .select('order_number, name, phone, address, postcode, notes, total, items, product_name, variant_name, quantity')
    .in('status', ['confirmed', 'preparing'])
    .is('tracking_number', null)
    .or('payment_status.eq.paid,payment_method.in.(cod,bank_transfer)')
    .gte('created_at', sinceISO)

  for (const o of lp ?? []) {
    const postcode = (o.postcode ?? extractPostcode(o.address) ?? '').toString().trim()
    if (!postcode || posOnly.has(postcode) || !getZone(postcode)) continue   // KV sahaja
    const its = (Array.isArray(o.items) && o.items.length
      ? o.items
      : [{ product_name: o.product_name, variant_name: o.variant_name, quantity: o.quantity }]
    ) as { product_name: string; variant_name: string | null; quantity: number }[]
    for (const it of its) {
      rows.push(mkRow({
        orderId: o.order_number, recipient: o.name ?? '', phone: o.phone ?? '',
        zipcode: postcode, postTown: '', state: '', address: o.address ?? '',
        total: Number(o.total) || 0, notes: o.notes ?? '',
        product: it.product_name, variation: it.variant_name ?? '', qty: it.quantity ?? 1,
      }))
    }
  }

  // ── Jana Excel ────────────────────────────────────────────────────────────
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Orders')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const fname = `lalamove-export-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  })
}

function mkRow(o: {
  orderId: string; recipient: string; phone: string; zipcode: string; postTown: string; state: string
  address: string; total: number; notes: string; product: string; variation: string; qty: number
}): Row {
  return {
    'Order ID': o.orderId,
    'Recipient': o.recipient,
    'Phone #': o.phone,
    'Zipcode': o.zipcode,
    'Post Town': o.postTown,
    'State': o.state,
    'Detail Address': o.address,
    'Additional address information': '',
    'Product Category': CATEGORY,
    'Product Name': o.product,
    'Variation': o.variation,
    'Quantity': o.qty,
    'Weight(kg)': 1,
    'Delivery Option': DELIVERY_OPTION,   // mesti ada "seller"
    'Order Amount': o.total,
    'Buyer Message': o.notes,
  }
}
