import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAppSettings } from '@/lib/app-settings'
import { sendWhatsApp } from '@/lib/murpati'
import { getWaTemplates, buildConfirmationMessage } from '@/lib/wa-templates'
import { sendOrderConfirmationEmail } from '@/lib/zeptomail'
import { NextResponse } from 'next/server'

const VALID_PAYMENT = ['cod', 'bank_transfer', 'fpx', 'ewallet']
const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

function getAppUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit && !explicit.includes('localhost')) return explicit
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return explicit ?? 'http://localhost:3006'
}

interface OrderItem {
  product_id: string
  variant_id?: string | null
  product_name: string
  variant_name?: string | null
  quantity: number
  unit_price: number
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug || !/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json({ error: 'Tidak sah' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const { name, phone, address, postcode, notes, payment_method = 'cod', source, items, delivery_method, pickup_date, promo_code, use_points, email } = body

  const isPickup = delivery_method === 'pickup'
  const PICKUP_ADDRESS = 'Ambil Sendiri — SyababFresh, Bangi'
  // Email pilihan — bila sah, hantar email selari WhatsApp
  const customerEmail = (typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
    ? email.trim().toLowerCase() : null

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length < 2)
    return NextResponse.json({ error: 'Nama diperlukan' }, { status: 400 })
  if (!phone || typeof phone !== 'string' || !/^[0-9+\s-]{8,15}$/.test(phone.trim()))
    return NextResponse.json({ error: 'No. telefon tidak sah' }, { status: 400 })
  // Alamat tak wajib untuk pickup (ambil sendiri di kedai)
  if (!isPickup && (!address || typeof address !== 'string' || address.trim().length < 10))
    return NextResponse.json({ error: 'Alamat terlalu pendek' }, { status: 400 })
  // Poskod wajib untuk penghantaran — supaya zon kurier dapat ditentukan (LK/Pos)
  if (!isPickup && !/^\d{5}$/.test(String(postcode ?? '').trim()))
    return NextResponse.json({ error: 'Poskod diperlukan (5 digit)' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: 'Tiada item dalam pesanan' }, { status: 400 })
  if (items.length > 20)
    return NextResponse.json({ error: 'Terlalu banyak item' }, { status: 400 })
  if (!VALID_PAYMENT.includes(payment_method))
    return NextResponse.json({ error: 'Kaedah bayaran tidak sah' }, { status: 400 })

  for (const item of items as OrderItem[]) {
    if (!item.product_id || typeof item.product_id !== 'string')
      return NextResponse.json({ error: 'Item tidak sah' }, { status: 400 })
    if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 99)
      return NextResponse.json({ error: 'Kuantiti tidak sah' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Auth pilihan — pembeli LP yang login boleh tebus mata loyalty (guest kekal dibenarkan)
  const userClient = await createClient()
  const { data: { user: authUser } } = await userClient.auth.getUser()
  const userId = authUser?.id ?? null

  // Get landing page
  const { data: page } = await supabase
    .from('landing_pages')
    .select('id, title')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  if (!page) return NextResponse.json({ error: 'Halaman tidak dijumpai' }, { status: 404 })

  // Validate all products + get server-side prices
  const productIds = [...new Set((items as OrderItem[]).filter(i => !i.variant_id).map(i => i.product_id))]
  const variantIds = [...new Set((items as OrderItem[]).filter(i => i.variant_id).map(i => i.variant_id!))]

  const [productsRes, variantsRes] = await Promise.all([
    productIds.length > 0
      ? supabase.from('products').select('id, name, price, is_active, weight_grams').in('id', productIds)
      : Promise.resolve({ data: [] }),
    variantIds.length > 0
      ? supabase.from('product_variants').select('id, product_id, name, price, weight_grams, is_active, products(id, name, is_active)').in('id', variantIds)
      : Promise.resolve({ data: [] }),
  ])

  const productMap = new Map((productsRes.data ?? []).map(p => [p.id, p]))
  const variantMap = new Map((variantsRes.data ?? []).map(v => [v.id, v]))

  let subtotal = 0
  const validatedItems: OrderItem[] = []

  for (const item of items as OrderItem[]) {
    if (item.variant_id) {
      const variant = variantMap.get(item.variant_id)
      if (!variant || !variant.is_active) return NextResponse.json({ error: `Variant tidak tersedia` }, { status: 400 })
      const prod = (variant.products as any)
      if (!prod || !prod.is_active) return NextResponse.json({ error: `Produk tidak tersedia` }, { status: 400 })
      const unitPrice = Number(variant.price)
      subtotal += unitPrice * item.quantity
      validatedItems.push({ ...item, product_name: prod.name, variant_name: variant.name, unit_price: unitPrice })
    } else {
      const product = productMap.get(item.product_id)
      if (!product || !product.is_active) return NextResponse.json({ error: `Produk tidak tersedia` }, { status: 400 })
      const unitPrice = Number(product.price)
      subtotal += unitPrice * item.quantity
      validatedItems.push({ ...item, product_name: product.name, unit_price: unitPrice })
    }
  }

  // Delivery fee
  const appSettings = await getAppSettings()
  const FREE_MIN = Number(appSettings.free_delivery_min ?? 80)
  let deliveryFee = Number(appSettings.default_delivery_fee ?? 15)

  const KL_STATES = new Set(['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya'])

  if (isPickup) {
    deliveryFee = 0   // ambil sendiri — tiada caj penghantaran
  } else if (subtotal >= FREE_MIN) {
    deliveryFee = 0
  } else if (postcode && /^\d{5}$/.test(postcode)) {
    const { data: zone } = await supabase.from('delivery_zones').select('delivery_fee, state, is_active').eq('postcode', postcode).maybeSingle()
    if (zone && !zone.is_active)
      return NextResponse.json({ error: 'Penghantaran tidak tersedia ke kawasan ini' }, { status: 400 })
    if (zone) {
      const pc = parseInt(postcode, 10)
      const isKlByPostcode = !isNaN(pc) &&
        ((pc >= 40000 && pc <= 48999) || (pc >= 50000 && pc <= 60000) || (pc >= 62000 && pc <= 64000))
      const isKl = zone.state ? KL_STATES.has(zone.state) : isKlByPostcode
      if (!isKl) {
        // Non-KL: weight-based Ninja Cold pricing
        const totalWeightKg = validatedItems.reduce((sum, i) => {
          const variant = i.variant_id ? variantMap.get(i.variant_id) : null
          const product = !i.variant_id ? productMap.get(i.product_id) : null
          const wg = (variant as any)?.weight_grams ?? (product as any)?.weight_grams ?? 500
          return sum + (wg * i.quantity) / 1000
        }, 0)
        const { data: tier } = await supabase
          .from('shipping_weight_tiers')
          .select('fee')
          .eq('carrier_id', 'ninja_cold')
          .lte('min_kg', totalWeightKg)
          .or(`max_kg.is.null,max_kg.gt.${totalWeightKg}`)
          .order('min_kg', { ascending: false })
          .limit(1)
          .maybeSingle()
        deliveryFee = tier ? Number(tier.fee) : Number(zone.delivery_fee)
      } else {
        deliveryFee = Number(zone.delivery_fee)
      }
    }
  }

  // ── Validate promo code server-side (guest — had global sahaja) ──
  let promoCodeId: string | null = null
  let discount = 0
  if (promo_code && typeof promo_code === 'string') {
    const code = promo_code.trim().toUpperCase()
    const { data: promo } = await supabase
      .from('promo_codes')
      .select('id, type, value, min_order, max_uses, uses_count, expires_at, active')
      .eq('code', code)
      .maybeSingle()
    if (!promo || !promo.active) return NextResponse.json({ error: 'Kod promosi tidak sah atau tidak aktif' }, { status: 400 })
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return NextResponse.json({ error: 'Kod promosi sudah tamat tempoh' }, { status: 400 })
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) return NextResponse.json({ error: 'Kod promosi sudah mencapai had penggunaan' }, { status: 400 })
    if (subtotal < Number(promo.min_order)) return NextResponse.json({ error: `Min. pesanan RM${Number(promo.min_order).toFixed(2)} untuk kod ini` }, { status: 400 })
    discount = promo.type === 'percentage'
      ? Math.min((subtotal * Number(promo.value)) / 100, subtotal)
      : Math.min(Number(promo.value), subtotal)
    promoCodeId = promo.id
  }

  // ── Loyalty redemption (logged-in sahaja; baki mata dibaca server-side) ──
  let pointsUsed = 0
  let pointsDiscount = 0
  if (userId && use_points) {
    const { data: prof } = await supabase.from('profiles').select('total_points').eq('id', userId).single()
    const userPoints = Number(prof?.total_points ?? 0)
    const redeemable = Math.max(0, subtotal + deliveryFee - discount) // jumlah yang mata boleh offset
    pointsUsed = Math.min(userPoints, Math.floor(redeemable * 100)) // 100 mata = RM1
    pointsDiscount = pointsUsed / 100
  }

  const total = Math.max(0, subtotal + deliveryFee - discount - pointsDiscount)

  // Generate order number
  const { data: orderNumber } = await supabase.rpc('generate_lp_order_number')

  // First item for backward compat columns (nullable now)
  const first = validatedItems[0]

  const { data: order, error } = await supabase
    .from('lp_guest_orders')
    .insert({
      order_number: orderNumber,
      page_id: page.id,
      name: name.trim(),
      phone: phone.trim(),
      address: isPickup ? PICKUP_ADDRESS : address.trim(),
      postcode: isPickup ? null : (postcode?.trim() || null),
      notes: notes?.trim() || null,
      delivery_method: isPickup ? 'pickup' : 'delivery',
      pickup_date: isPickup && typeof pickup_date === 'string' && pickup_date ? pickup_date : null,
      promo_code_id: promoCodeId,
      discount,
      user_id: userId,
      points_used: pointsUsed,
      points_discount: pointsDiscount,
      email: customerEmail,
      product_id: first.product_id,
      variant_id: first.variant_id || null,
      product_name: first.product_name,
      variant_name: first.variant_name || null,
      quantity: first.quantity,
      unit_price: first.unit_price,
      delivery_fee: deliveryFee,
      total,
      payment_method,
      source: source?.trim().slice(0, 100) || null,
      items: validatedItems,
    })
    .select('id, order_number, total, delivery_fee')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // FPX / e-wallet — redirect to Chip payment gateway
  if (payment_method === 'fpx' || payment_method === 'ewallet') {
    if (!process.env.CHIP_SECRET_KEY || !process.env.CHIP_BRAND_ID) {
      return NextResponse.json({ error: 'Payment gateway tidak dikonfigurasi' }, { status: 503 })
    }
    const appUrl = getAppUrl()
    // Ada diskaun (promo / mata) → hantar satu baris = total supaya Chip caj tepat (elak baris negatif).
    // Tiada diskaun → itemize macam biasa (resit lebih kemas).
    const hasDiscount = discount > 0 || pointsDiscount > 0
    const products = hasDiscount
      ? [{ name: `Pesanan ${order.order_number}`, price: Math.round(Number(total) * 100), quantity: 1 }]
      : validatedItems.map(i => ({
          name: `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`,
          price: Math.round(Number(i.unit_price) * 100),
          quantity: i.quantity,
        }))
    if (!hasDiscount && deliveryFee > 0) products.push({ name: 'Kos Penghantaran', price: Math.round(deliveryFee * 100), quantity: 1 })

    const chipRes = await fetch(`${CHIP_API_URL}/purchases/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { email: `lp+${order.order_number}@syababfresh.my`, full_name: name.trim(), phone: phone.trim() },
        purchase: { currency: 'MYR', products, notes: order.order_number },
        brand_id: process.env.CHIP_BRAND_ID,
        reference: order.id,
        success_redirect: `${appUrl}/lp/${slug}/berjaya?pesanan=${order.order_number}`,
        failure_redirect: `${appUrl}/lp/${slug}?bayar=gagal`,
        cancel_redirect: `${appUrl}/lp/${slug}`,
        success_callback: `${appUrl}/api/webhook/chip`,
        send_receipt: false,
      }),
    })
    if (!chipRes.ok) return NextResponse.json({ error: 'Gagal sambung payment gateway' }, { status: 502 })
    const chipData = await chipRes.json()
    if (!chipData.checkout_url) return NextResponse.json({ error: 'Tiada checkout URL' }, { status: 502 })

    // Store CHIP purchase id so the success page can verify payment directly (webhook fallback)
    if (chipData.id) {
      await supabase.from('lp_guest_orders').update({ payment_ref: chipData.id }).eq('id', order.id)
    }

    return NextResponse.json({ checkoutUrl: chipData.checkout_url, order_number: order.order_number })
  }

  // COD / bank_transfer — promo uses naik sekarang (FPX dikira dalam webhook selepas bayar)
  if (promoCodeId) {
    await supabase.rpc('increment_promo_uses', { promo_id: promoCodeId })
  }

  // COD / bank_transfer — tolak mata ditebus sekarang (FPX ditangguh ke webhook/verify selepas bayar)
  if (pointsUsed > 0 && userId) {
    await supabase.from('loyalty_transactions').insert({
      user_id: userId, order_id: null, points: -pointsUsed, type: 'redeem',
      description: `Redeem ${pointsUsed} mata untuk LP ${order.order_number}`,
    })
    await supabase.rpc('increment_points', { uid: userId, pts: -pointsUsed })
  }

  // COD / bank_transfer — hantar WhatsApp terus (FPX handled in webhook after payment)
  const appUrl = getAppUrl()
  const itemLines = validatedItems.map(i =>
    `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} × ${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`
  ).join('\n')
  const payLabel: Record<string, string> = { cod: 'Bayar Semasa Terima (COD)', bank_transfer: 'Pindahan Bank' }
  const templates = await getWaTemplates()

  // WhatsApp to customer — fully template-driven (editable in /admin/settings/whatsapp)
  sendWhatsApp(phone.trim(), buildConfirmationMessage(templates, 'order_received', {
    name: name.trim(),
    order_number: order.order_number,
    lp_title: page.title,
    items: itemLines,
    total: Number(order.total).toFixed(2),
    payment_method: payLabel[payment_method] ?? payment_method,
    app_url: appUrl,
  })).catch(() => {})

  // Email selari WA (kalau customer isi email)
  if (customerEmail) {
    sendOrderConfirmationEmail({
      to: customerEmail,
      customerName: name.trim(),
      orderNumber: order.order_number,
      items: validatedItems.map(i => ({ name: i.product_name, quantity: i.quantity, unit_price: Number(i.unit_price), variant_name: i.variant_name ?? null })),
      total: Number(order.total),
      deliveryAddress: isPickup ? PICKUP_ADDRESS : address.trim(),
      deliverySlot: null,
      paymentMethod: payment_method,
      notes: notes?.trim() || null,
    }).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    order_number: order.order_number,
    total: order.total,
    delivery_fee: order.delivery_fee,
    payment_method,
  })
}

// Delivery fee preview (GET)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const postcode = url.searchParams.get('postcode') ?? ''
  const subtotal = parseFloat(url.searchParams.get('subtotal') ?? '0')

  if (!/^\d{5}$/.test(postcode)) return NextResponse.json({ available: true, fee: 15 })

  const supabase = createAdminClient()
  const appSettings = await getAppSettings()
  const FREE_MIN = Number(appSettings.free_delivery_min ?? 80)
  let fee = Number(appSettings.default_delivery_fee ?? 15)

  // Check blacklist — zone exists but is_active = false
  const { data: zone } = await supabase.from('delivery_zones').select('delivery_fee, state, is_active').eq('postcode', postcode).maybeSingle()
  if (zone && !zone.is_active) {
    return NextResponse.json({ available: false, fee: null })
  }

  const KL_STATES_GET = new Set(['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya'])
  const qty = parseInt(url.searchParams.get('qty') ?? '1', 10)

  if (subtotal >= FREE_MIN) {
    fee = 0
  } else if (zone) {
    const pcn = parseInt(postcode, 10)
    const isKlByPc = !isNaN(pcn) &&
      ((pcn >= 40000 && pcn <= 48999) || (pcn >= 50000 && pcn <= 60000) || (pcn >= 62000 && pcn <= 64000))
    const isKl = zone.state ? KL_STATES_GET.has(zone.state) : isKlByPc
    if (!isKl) {
      const totalWeightKg = Math.max(qty, 1) * 1.0
      const { data: tier } = await supabase
        .from('shipping_weight_tiers')
        .select('fee')
        .eq('carrier_id', 'ninja_cold')
        .lte('min_kg', totalWeightKg)
        .or(`max_kg.is.null,max_kg.gt.${totalWeightKg}`)
        .order('min_kg', { ascending: false })
        .limit(1)
        .maybeSingle()
      fee = tier ? Number(tier.fee) : Number(zone.delivery_fee)
    } else {
      fee = Number(zone.delivery_fee)
    }
  }

  return NextResponse.json({ available: true, fee })
}
