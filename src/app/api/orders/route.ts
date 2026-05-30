import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/app-settings'

interface CartItem {
  product_id: string
  variant_id: string | null
  quantity: number
}

export async function POST(request: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    items, postcode, payment_method,
    delivery_address, delivery_slot, notes,
    promo_code, use_points,
  } = body

  // Basic guards
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Tiada item dalam pesanan' }, { status: 400 })
  if (items.length > 50) return NextResponse.json({ error: 'Terlalu banyak item' }, { status: 400 })
  if (!delivery_address || typeof delivery_address !== 'string') return NextResponse.json({ error: 'Alamat diperlukan' }, { status: 400 })
  if (delivery_address.length > 500) return NextResponse.json({ error: 'Alamat terlalu panjang' }, { status: 400 })
  if (notes && (typeof notes !== 'string' || notes.length > 500)) return NextResponse.json({ error: 'Nota terlalu panjang' }, { status: 400 })
  if (!payment_method || typeof payment_method !== 'string') return NextResponse.json({ error: 'Kaedah bayaran diperlukan' }, { status: 400 })
  const VALID_PAYMENT_METHODS = ['fpx', 'ewallet', 'cod', 'bank_transfer']
  if (!VALID_PAYMENT_METHODS.includes(payment_method)) return NextResponse.json({ error: 'Kaedah bayaran tidak sah' }, { status: 400 })

  // Validate item structure
  for (const item of items as CartItem[]) {
    if (!item.product_id || typeof item.product_id !== 'string') return NextResponse.json({ error: 'Item tidak sah' }, { status: 400 })
    if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 999) return NextResponse.json({ error: 'Kuantiti tidak sah' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Rate limit: max 5 orders per user per 10 min ──────────────────
  const { count: recentCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json({ error: 'Terlalu banyak pesanan dalam masa singkat. Sila cuba lagi sebentar.' }, { status: 429 })
  }

  // ── Recalculate prices from DB — never trust client ───────────────
  const productIds = [...new Set((items as CartItem[]).filter(i => !i.variant_id).map(i => i.product_id))]
  const variantIds = [...new Set((items as CartItem[]).filter(i => i.variant_id).map(i => i.variant_id!))]

  const [productsRes, variantsRes] = await Promise.all([
    productIds.length > 0
      ? supabase.from('products').select('id, name, price, image_url, is_active').in('id', productIds)
      : Promise.resolve({ data: [] }),
    variantIds.length > 0
      ? supabase.from('product_variants').select('id, product_id, name, price, weight_grams, is_active, products(id, name, image_url, is_active)').in('id', variantIds)
      : Promise.resolve({ data: [] }),
  ])

  const productMap = new Map((productsRes.data ?? []).map(p => [p.id, p]))
  const variantMap = new Map((variantsRes.data ?? []).map(v => [v.id, v]))

  // Build order items with server-fetched prices
  const orderItemsPayload: Array<{
    product_id: string; product_name: string; product_image: string | null
    quantity: number; unit_price: number; subtotal: number
    variant_id: string | null; variant_name: string | null; weight_grams: number | null
  }> = []

  let subtotal = 0

  for (const item of items as CartItem[]) {
    if (item.variant_id) {
      const variant = variantMap.get(item.variant_id)
      if (!variant || !variant.is_active) return NextResponse.json({ error: `Variant tidak tersedia` }, { status: 400 })
      const product = (variant.products as any)
      if (!product || !product.is_active) return NextResponse.json({ error: `Produk tidak tersedia` }, { status: 400 })
      const unitPrice = Number(variant.price)
      const itemSubtotal = unitPrice * item.quantity
      subtotal += itemSubtotal
      orderItemsPayload.push({
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url ?? null,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
        variant_id: variant.id,
        variant_name: variant.name,
        weight_grams: variant.weight_grams ?? null,
      })
    } else {
      const product = productMap.get(item.product_id)
      if (!product || !product.is_active) return NextResponse.json({ error: `Produk tidak tersedia` }, { status: 400 })
      const unitPrice = Number(product.price)
      const itemSubtotal = unitPrice * item.quantity
      subtotal += itemSubtotal
      orderItemsPayload.push({
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url ?? null,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
        variant_id: null,
        variant_name: null,
        weight_grams: null,
      })
    }
  }

  // ── Recalculate delivery fee from DB ─────────────────────────────
  const appSettings = await getAppSettings()
  const FREE_DELIVERY_MIN = Number(appSettings['free_delivery_min'] ?? 80)
  let deliveryFee = Number(appSettings['default_delivery_fee'] ?? 15)

  const KL_STATES = new Set(['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya'])

  if (subtotal >= FREE_DELIVERY_MIN) {
    deliveryFee = 0
  } else if (postcode && typeof postcode === 'string' && /^\d{5}$/.test(postcode)) {
    const { data: zone } = await supabase
      .from('delivery_zones')
      .select('delivery_fee, state')
      .eq('postcode', postcode)
      .maybeSingle()

    if (zone) {
      // Fallback: detect KL by postcode range if state is null
      const pc = parseInt(postcode, 10)
      const isKlByPostcode = !isNaN(pc) &&
        ((pc >= 40000 && pc <= 48999) || (pc >= 50000 && pc <= 60000) || (pc >= 62000 && pc <= 64000))
      const isKl = zone.state ? KL_STATES.has(zone.state) : isKlByPostcode
      if (!isKl) {
        // Non-KL: use Ninja Cold weight-based pricing
        const totalWeightKg = orderItemsPayload.reduce(
          (sum, item) => sum + ((item.weight_grams ?? 500) * item.quantity) / 1000,
          0
        )
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

  // ── Load profile for points ───────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_points, loyalty_tiers(multiplier)')
    .eq('id', user.id)
    .single()

  const userPoints = profile?.total_points ?? 0
  const multiplier = (profile?.loyalty_tiers as any)?.multiplier ?? 1

  // ── Validate promo code server-side ──────────────────────────────
  let appliedPromo: { id: string; code: string; type: string; value: number } | null = null
  let promoDiscount = 0

  if (promo_code && typeof promo_code === 'string') {
    const code = promo_code.trim().toUpperCase()
    const { data: promo } = await supabase
      .from('promo_codes')
      .select('id, code, type, value, min_order, max_uses, uses_count, expires_at, active')
      .eq('code', code)
      .maybeSingle()

    if (!promo || !promo.active) return NextResponse.json({ error: 'Kod promosi tidak sah atau tidak aktif' }, { status: 400 })
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return NextResponse.json({ error: 'Kod promosi sudah tamat tempoh' }, { status: 400 })
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) return NextResponse.json({ error: 'Kod promosi sudah mencapai had penggunaan' }, { status: 400 })
    if (subtotal < Number(promo.min_order)) return NextResponse.json({ error: `Min. pesanan RM${Number(promo.min_order).toFixed(2)} untuk kod ini` }, { status: 400 })

    const { count: usedCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('promo_code_id', promo.id)
      .neq('status', 'cancelled')

    if ((usedCount ?? 0) > 0) return NextResponse.json({ error: 'Anda sudah menggunakan kod ini sebelum ini' }, { status: 400 })

    appliedPromo = { id: promo.id, code: promo.code, type: promo.type, value: Number(promo.value) }
    promoDiscount = promo.type === 'percentage'
      ? Math.min((subtotal * Number(promo.value)) / 100, subtotal)
      : Math.min(Number(promo.value), subtotal)
  }

  // ── Points ────────────────────────────────────────────────────────
  const POINTS_RATE = 100 // 100 mata = RM1 (1% pulangan asas)
  const pointsDiscount = use_points ? Math.min(userPoints / POINTS_RATE, subtotal + deliveryFee) : 0
  const pointsUsed = use_points ? Math.min(userPoints, Math.floor((subtotal + deliveryFee) * POINTS_RATE)) : 0

  const total = Math.max(0, subtotal + deliveryFee - promoDiscount - pointsDiscount)

  // ── First-order check for COD/bank_transfer ───────────────────────
  // New customers placing offline-payment orders need admin approval
  // before inventory is deducted — prevents fake order abuse
  const isCodLike = payment_method === 'cod' || payment_method === 'bank_transfer'
  let needsApproval = false

  if (isCodLike) {
    const { count: prevOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'cancelled')

    needsApproval = (prevOrders ?? 0) === 0
  }

  // ── Create order ──────────────────────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      order_number: 'TEMP',
      status: 'pending',
      subtotal,
      delivery_fee: deliveryFee,
      discount: promoDiscount,
      points_used: pointsUsed,
      points_discount: pointsDiscount,
      total,
      payment_method,
      payment_status: 'unpaid',
      delivery_address,
      promo_code_id: appliedPromo?.id ?? null,
      delivery_slot: delivery_slot ?? null,
      notes: notes || null,
      needs_approval: needsApproval,
    })
    .select()
    .single()

  if (orderError || !order) return NextResponse.json({ error: 'Gagal buat pesanan' }, { status: 500 })

  // ── Create order items (server-side, using DB prices) ─────────────
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsPayload.map(item => ({ ...item, order_id: order.id })))

  if (itemsError) {
    // Rollback order if items fail
    await supabase.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Gagal simpan item pesanan' }, { status: 500 })
  }

  // Parse nama & phone dari delivery_address ("Nama | Phone\nAlamat")
  // Update profiles jika field kosong — supaya WhatsApp & notifikasi boleh sampai
  const firstLine = delivery_address.split('\n')[0] ?? ''
  const separatorIdx = firstLine.indexOf(' | ')
  if (separatorIdx > 0) {
    const parsedName  = firstLine.substring(0, separatorIdx).trim()
    const parsedPhone = firstLine.substring(separatorIdx + 3).trim()
    const updates: Record<string, string> = {}
    if (parsedName  && !(profile as any)?.full_name) updates.full_name = parsedName
    if (parsedPhone && !(profile as any)?.phone)     updates.phone     = parsedPhone
    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', user.id)
    }
  }

  return NextResponse.json({
    orderId: order.id,
    total,
    subtotal,
    deliveryFee,
    promoDiscount,
    pointsDiscount,
    pointsUsed,
    multiplier,
    needsApproval,
  })
}
