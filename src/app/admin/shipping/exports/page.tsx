export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExportsClient, type ExportOrder } from './exports-client'

// Override kurier per-poskod (delivery_zones.courier_override, diset admin di
// /admin/delivery). 'pos' = paksa Pos walaupun poskod dalam julat LK (Lalamove tak
// sampai, cth Serendah/KKB/Kerling). 'lalamove' = paksa Lalamove (Pos tak sampai).
// Tiada override → auto ikut julat poskod.
type CourierOverride = 'pos' | 'lalamove'
function applyOverride(ov: CourierOverride | undefined, auto: boolean): boolean {
  if (ov === 'pos') return false
  if (ov === 'lalamove') return true
  return auto
}

// pickup=false → order hantar (untuk tab Export). pickup=true → order ambil sendiri
// (untuk tab Pickup). Aliran pengayaan (profil/alamat/item) sama untuk dua-dua.
async function getOrders(from: string, to: string, pickup: boolean, overrides: Map<string, CourierOverride>, towns: Map<string, string>): Promise<ExportOrder[]> {
  const supabase = createAdminClient()

  let q = supabase
    .from('orders')
    .select('id, order_number, status, payment_method, payment_status, total, notes, created_at, user_id, address_id, delivery_address, exported_at, pickup_date, delivery_slot')
    // Export: confirmed/preparing sahaja (delivering = dah ada tracking → keluar).
    // Pickup: sertakan 'delivering' (= sedia diambil) supaya staf boleh tanda "Dah Diambil".
    .in('status', pickup ? ['confirmed', 'preparing', 'delivering'] : ['confirmed', 'preparing'])
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
  q = pickup ? q.eq('delivery_method', 'pickup') : q.neq('delivery_method', 'pickup')
  const { data: orders } = await q

  if (!orders || orders.length === 0) return []

  const orderIds = orders.map((o) => o.id)
  const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))]
  const addressIds = [...new Set(orders.map((o) => o.address_id).filter(Boolean))]

  const [profilesRes, addressesRes, itemsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, email').in('id', userIds),
    addressIds.length
      ? supabase.from('addresses').select('id, full_address, city, postcode, state, recipient_name, recipient_phone').in('id', addressIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('order_items')
      .select('order_id, product_name, quantity, variant_name, products(is_shippable)')
      .in('order_id', orderIds),
  ])

  const profileMap = new Map<string, { full_name: string | null; phone: string | null; email: string | null }>()
  for (const p of profilesRes.data ?? []) profileMap.set(p.id, p)

  const addressMap = new Map<string, { full_address: string; city: string | null; postcode: string | null; state: string | null; recipient_name: string | null; recipient_phone: string | null }>()
  for (const a of addressesRes.data ?? []) addressMap.set(a.id, a)

  const KL_STATES = new Set(['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya'])

  // LK (Lembah Klang) postcode prefixes: KL 50-60, Putrajaya 62-63, Selangor 40-48, Shah Alam 40xxx, Klang 41xxx, etc.
  function isKlPostcode(pc: string | null | undefined): boolean | null {
    if (!pc || pc.length !== 5) return null
    const n = parseInt(pc, 10)
    if (isNaN(n)) return null
    // Selangor: 40000-48999, KL: 50000-60000, Putrajaya: 62000-64000
    return (n >= 40000 && n <= 48999) || (n >= 50000 && n <= 60000) || (n >= 62000 && n <= 64000)
  }

  function extractPostcode(addr: string | null | undefined): string | null {
    if (!addr) return null
    const m = addr.match(/\b(\d{5})\b/)
    return m ? m[1] : null
  }

  const itemsMap = new Map<string, { product_name: string; quantity: number; variant_name: string | null; is_shippable: boolean }[]>()
  const hasFreshMap = new Map<string, boolean>() // order_id → has any non-shippable item

  for (const item of itemsRes.data ?? []) {
    const productInfo = ((item.products as unknown) as { is_shippable: boolean } | null)
    // When product info missing, default false (assume segar — safer for cold chain)
    const isShippable = productInfo !== null ? productInfo.is_shippable : false
    const existing = itemsMap.get(item.order_id) ?? []
    existing.push({ product_name: item.product_name, quantity: item.quantity, variant_name: item.variant_name, is_shippable: isShippable })
    itemsMap.set(item.order_id, existing)
    if (!isShippable) hasFreshMap.set(item.order_id, true)
  }

  return orders.map((o) => {
    const profile = profileMap.get(o.user_id)
    const address = o.address_id ? addressMap.get(o.address_id) : null
    const state = address?.state ?? null
    // Determine KL: try state first, then postcode
    const postcode = address?.postcode ?? extractPostcode(o.delivery_address)
    const isKlByState = state ? KL_STATES.has(state) : null
    const isKlByPostcode = postcode ? isKlPostcode(postcode) : null
    const is_kl = applyOverride(postcode ? overrides.get(postcode) : undefined, isKlByState ?? isKlByPostcode ?? false)
    const area_known = isKlByState !== null || isKlByPostcode !== null
    const post_town = (postcode ? towns.get(postcode) : '') || address?.city || ''
    const has_fresh = hasFreshMap.get(o.id) ?? false
    return {
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      total: o.total,
      notes: o.notes,
      created_at: o.created_at,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? address?.recipient_phone ?? null,
      email: profile?.email ?? null,
      full_address: address?.full_address ?? o.delivery_address ?? null,
      city: address?.city ?? null,
      postcode,
      state,
      is_kl,
      area_known,
      has_fresh,
      post_town,
      recipient_name: address?.recipient_name ?? profile?.full_name ?? null,
      recipient_phone: address?.recipient_phone ?? profile?.phone ?? null,
      items: itemsMap.get(o.id) ?? [],
      exported_at: (o as any).exported_at ?? null,
      source: 'order' as const,
      user_id: o.user_id ?? null,
      pickup_date: (o as any).pickup_date ?? null,
      delivery_slot: (o as any).delivery_slot ?? null,
    }
  })
}

// ── LP guest orders → ExportOrder ──────────────────────────────────────────────
function extractPostcodeFromAddr(addr: string | null): string | null {
  if (!addr) return null
  const m = addr.match(/\b(\d{5})\b/)
  return m ? m[1] : null
}
function isKlPostcode(pc: string | null): boolean {
  if (!pc) return false
  const n = parseInt(pc, 10)
  return (n >= 40000 && n <= 48999) || (n >= 50000 && n <= 60000) || (n >= 62000 && n <= 64000)
}
function mapLpOrder(lp: any, overrides: Map<string, CourierOverride>, towns: Map<string, string>): ExportOrder {
  const postcode = lp.postcode ?? extractPostcodeFromAddr(lp.address)
  const items = (Array.isArray(lp.items) && lp.items.length > 0
    ? lp.items
    : [{ product_name: lp.product_name, variant_name: lp.variant_name, quantity: lp.quantity }]
  ).map((i: any) => ({ product_name: i.product_name, quantity: i.quantity, variant_name: i.variant_name ?? null, is_shippable: false }))
  return {
    id: lp.id,
    order_number: lp.order_number,
    status: lp.status,
    payment_method: lp.payment_method,
    payment_status: lp.payment_status ?? 'unpaid',
    total: lp.total,
    notes: lp.notes ?? null,
    created_at: lp.created_at,
    full_name: lp.name,
    phone: lp.phone,
    email: lp.email ?? null,
    full_address: lp.address ?? null,
    city: null,
    postcode,
    state: null,
    is_kl: applyOverride(postcode ? overrides.get(postcode) : undefined, isKlPostcode(postcode)),
    area_known: !!postcode,
    has_fresh: true,
    post_town: (postcode ? towns.get(postcode) : '') || '',
    recipient_name: lp.name,
    recipient_phone: lp.phone,
    items,
    exported_at: lp.exported_at ?? null,
    source: 'lp' as const,
    user_id: lp.user_id ?? null,
    delivery_slot: lp.delivery_slot ?? null,
    pickup_date: lp.pickup_date ?? null,
  }
}

export default async function ShippingExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/admin')

  const params = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0]
  const fromDate = params.from ?? sevenDaysAgo
  const toDate = params.to ?? today

  const fromISO = `${fromDate}T00:00:00+08:00`
  const toISO = `${toDate}T23:59:59+08:00`

  const supabaseAdmin = createAdminClient()

  // Dari delivery_zones: (a) override kurier — ambil baris yg ada override sahaja (kecil);
  // (b) Post Town — tapis KL/Selangor je. delivery_zones >1000 baris (cap PostgREST 1000),
  // jadi JANGAN select semua tanpa tapis. Lalamove export KL sahaja → 357 baris cukup.
  const KL_STATES_Q = ['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya']
  const [ovRes, townRes] = await Promise.all([
    supabaseAdmin.from('delivery_zones').select('postcode, courier_override').not('courier_override', 'is', null),
    supabaseAdmin.from('delivery_zones').select('postcode, city, area_name').in('state', KL_STATES_Q),
  ])
  const overrides = new Map<string, CourierOverride>()
  for (const r of ovRes.data ?? []) overrides.set(r.postcode, r.courier_override as CourierOverride)
  // Post Town = nama kawasan spesifik (area_name) — cth poskod 42300 → "Bandar Puncak
  // Alam" (bukan city "Klang"), 43200 → "Cheras" (bukan "Kajang"). Fallback city.
  const towns = new Map<string, string>()
  for (const r of townRes.data ?? []) { const town = r.area_name || r.city; if (town) towns.set(r.postcode, town) }

  const [deliveryOrders, pickupStoreOrders, lpRes] = await Promise.all([
    getOrders(fromISO, toISO, false, overrides, towns),
    getOrders(fromISO, toISO, true, overrides, towns),
    supabaseAdmin.from('lp_guest_orders')
      .select('id, order_number, name, phone, email, address, postcode, notes, status, total, payment_method, payment_status, created_at, items, product_name, variant_name, quantity, unit_price, exported_at, delivery_method, pickup_date, user_id, source, delivery_slot')
      .in('status', ['confirmed', 'preparing', 'delivering'])   // delivering disertakan utk pickup; dibuang dari tab export di bawah
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: false }),
  ])

  // Order reseller (B2B) = delivery dirunding/uruskan sendiri → JANGAN masuk shipping
  // export (bukan penghantaran courier, elak AWB tak guna). Filter di JS, bukan .neq DB
  // (source NULL pada LP lama akan tersilap dibuang oleh .neq).
  const lpTagged = (lpRes.data ?? [])
    .filter((lp: any) => lp.source !== 'reseller')
    .map((lp: any) => ({ order: mapLpOrder(lp, overrides, towns), pickup: lp.delivery_method === 'pickup', status: lp.status }))
  // Export: pickup dibuang + delivering dibuang (kekal seperti asal). Pickup: semua status pickup.
  const lpDelivery = lpTagged.filter((x) => !x.pickup && x.status !== 'delivering').map((x) => x.order)
  const lpPickup = lpTagged.filter((x) => x.pickup).map((x) => x.order)

  // Order online (fpx/ewallet) yang BELUM bayar tak boleh dihantar — elak ia bocor ke
  // export & jadi AWB pendua. COD/bank transfer ship macam biasa (bayar masa hantar).
  // Polisi sama dengan senarai Orders (isPaidOrOffline).
  const isPayable = (o: ExportOrder) =>
    ['fpx', 'ewallet'].includes(o.payment_method) ? o.payment_status === 'paid' : true

  // Tab Export — order hantar sahaja (pickup dibuang)
  const allOrders = [...deliveryOrders, ...lpDelivery].filter(isPayable).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Tab Pickup — order ambil sendiri (kedai + LP), susun ikut tarikh ambil paling awal
  const pickupOrders = [...pickupStoreOrders, ...lpPickup].filter(isPayable).sort((a, b) => {
    const da = a.pickup_date ? new Date(a.pickup_date).getTime() : Infinity
    const db = b.pickup_date ? new Date(b.pickup_date).getTime() : Infinity
    return da - db || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return <ExportsClient orders={allOrders} pickupOrders={pickupOrders} defaultFrom={fromDate} defaultTo={toDate} />
}
