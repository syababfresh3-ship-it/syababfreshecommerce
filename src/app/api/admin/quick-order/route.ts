import { requireAdmin } from '@/lib/supabase/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { NextResponse } from 'next/server'
import { sendOrderConfirmationEmail } from '@/lib/zeptomail'

export async function POST(request: Request) {
  const { forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const supabase = createAdminClient()
  const body = await request.json()
  const { name, phone, email, address, postcode, notes, payment_method, items, source = 'whatsapp', discount, reseller_id, delivery_fee } = body
  const discountNum = Math.max(0, Number(discount) || 0)
  const isReseller = typeof reseller_id === 'string' && reseller_id.length > 0

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (!phone?.trim()) return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  if (!address?.trim()) return NextResponse.json({ error: 'Address required' }, { status: 400 })
  if (!/^\d{5}$/.test(String(postcode ?? '').trim())) return NextResponse.json({ error: 'Poskod diperlukan (5 digit)' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email ?? '').trim())) return NextResponse.json({ error: 'Email yang sah diperlukan' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'At least 1 item required' }, { status: 400 })

  // Validate items + get server-side prices
  const variantIds = items.filter((i: any) => i.variant_id).map((i: any) => i.variant_id)
  const productIds = items.filter((i: any) => !i.variant_id).map((i: any) => i.product_id)

  const [variantsRes, productsRes] = await Promise.all([
    variantIds.length > 0
      ? supabase.from('product_variants').select('id, product_id, name, price, is_active, products(id, name, is_active)').in('id', variantIds)
      : Promise.resolve({ data: [] }),
    productIds.length > 0
      ? supabase.from('products').select('id, name, price, is_active').in('id', productIds)
      : Promise.resolve({ data: [] }),
  ])

  const variantMap = new Map((variantsRes.data ?? []).map((v: any) => [v.id, v]))
  const productMap = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]))

  // Order reseller → guna harga dipersetujui (reseller_prices). Fallback retail kalau
  // belum diset (UI papar amaran). Key: `${product_id}:${variant_id ?? ''}`.
  const resellerPrice = new Map<string, number>()
  if (isReseller) {
    const { data: rp } = await supabase.from('reseller_prices').select('product_id, variant_id, price').eq('reseller_id', reseller_id)
    for (const r of rp ?? []) resellerPrice.set(`${r.product_id}:${r.variant_id ?? ''}`, Number(r.price))
  }
  const agreedPrice = (pid: string, vid: string | null, retail: number) =>
    isReseller ? (resellerPrice.get(`${pid}:${vid ?? ''}`) ?? retail) : retail

  let subtotal = 0
  const validatedItems: any[] = []

  for (const item of items) {
    if (item.variant_id) {
      const variant = variantMap.get(item.variant_id)
      if (!variant || !variant.is_active) return NextResponse.json({ error: `Variant not available` }, { status: 400 })
      const unitPrice = agreedPrice(variant.product_id, variant.id, Number(variant.price))
      subtotal += unitPrice * item.quantity
      validatedItems.push({ product_id: variant.product_id, variant_id: variant.id, product_name: (variant.products as any)?.name, variant_name: variant.name, quantity: item.quantity, unit_price: unitPrice })
    } else {
      const product = productMap.get(item.product_id)
      if (!product || !product.is_active) return NextResponse.json({ error: `Product not available` }, { status: 400 })
      const unitPrice = agreedPrice(product.id, null, Number(product.price))
      subtotal += unitPrice * item.quantity
      validatedItems.push({ product_id: product.id, variant_id: null, product_name: product.name, variant_name: null, quantity: item.quantity, unit_price: unitPrice })
    }
  }

  // Delivery fee. Reseller (B2B) = dirunding → terima override manual dari admin.
  // Order biasa = auto ikut poskod / free-min (override diabaikan, elak manipulasi klien).
  const appSettings = await getAppSettings()
  const FREE_MIN = Number(appSettings.free_delivery_min ?? 80)
  let deliveryFee = Number(appSettings.default_delivery_fee ?? 15)

  const deliveryOverride = Number(delivery_fee)
  if (isReseller && Number.isFinite(deliveryOverride) && deliveryOverride >= 0) {
    deliveryFee = deliveryOverride
  } else if (subtotal >= FREE_MIN) {
    deliveryFee = 0
  } else if (postcode && /^\d{5}$/.test(postcode)) {
    const { data: zone } = await supabase.from('delivery_zones').select('delivery_fee, state, is_active').eq('postcode', postcode).maybeSingle()
    if (zone?.is_active === false) return NextResponse.json({ error: 'Delivery not available to this area' }, { status: 400 })
    if (zone) deliveryFee = Number(zone.delivery_fee)
  }

  // Sales-negotiated discount (manual). Capped so total never goes below 0.
  const appliedDiscount = Math.min(discountNum, subtotal + deliveryFee)
  const total = subtotal + deliveryFee - appliedDiscount

  const { data: orderNumber } = await supabase.rpc('generate_lp_order_number')
  const first = validatedItems[0]

  const { data: order, error } = await supabase.from('lp_guest_orders').insert({
    order_number: orderNumber,
    page_id: null, // order manual — bukan LP (perlu migrasi 066: page_id nullable)
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || null,
    address: address.trim(),
    postcode: postcode?.trim() || null,
    notes: notes?.trim() || null,
    product_id: first.product_id,
    variant_id: first.variant_id,
    product_name: first.product_name,
    variant_name: first.variant_name,
    quantity: first.quantity,
    unit_price: first.unit_price,
    delivery_fee: deliveryFee,
    discount: appliedDiscount,
    total,
    payment_method: payment_method ?? 'bank_transfer',
    source: isReseller ? 'reseller' : source,
    reseller_id: isReseller ? reseller_id : null,
    items: validatedItems,
    status: 'confirmed', // WA orders already confirmed
  }).select('id, order_number, total').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Nota: WA pengesahan ke customer DIBUANG — guna email sahaja (kurangkan risiko
  // ban WA tidak rasmi). WA ke customer kini hanya untuk tracking.

  // Email confirmation (email kini wajib)
  if (email?.trim()) {
    sendOrderConfirmationEmail({
      to: email.trim(),
      customerName: name.trim(),
      orderNumber: order.order_number,
      items: validatedItems.map(i => ({ name: i.product_name, quantity: i.quantity, unit_price: Number(i.unit_price), variant_name: i.variant_name ?? null })),
      total: Number(order.total),
      deliveryAddress: address.trim(),
      deliverySlot: null,
      paymentMethod: payment_method ?? 'bank_transfer',
      notes: notes?.trim() || null,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, order_number: order.order_number, total: order.total })
}
