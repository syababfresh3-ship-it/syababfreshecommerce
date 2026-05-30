export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExportsClient, type ExportOrder } from './exports-client'

async function getOrders(from: string, to: string): Promise<ExportOrder[]> {
  const supabase = createAdminClient()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_method, payment_status, total, notes, created_at, user_id, address_id, delivery_address')
    .in('status', ['confirmed', 'preparing', 'delivering'])
    .neq('delivery_method', 'pickup')   // order ambil sendiri tak perlu dihantar
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })

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
  const hasKnownFreshMap = new Map<string, boolean>() // order_id → at least one item had product info

  for (const item of itemsRes.data ?? []) {
    const productInfo = ((item.products as unknown) as { is_shippable: boolean } | null)
    // When product info missing, default false (assume segar — safer for cold chain)
    const isShippable = productInfo !== null ? productInfo.is_shippable : false
    const existing = itemsMap.get(item.order_id) ?? []
    existing.push({ product_name: item.product_name, quantity: item.quantity, variant_name: item.variant_name, is_shippable: isShippable })
    itemsMap.set(item.order_id, existing)
    if (!isShippable) hasFreshMap.set(item.order_id, true)
    if (productInfo !== null) hasKnownFreshMap.set(item.order_id, true)
  }

  return orders.map((o) => {
    const profile = profileMap.get(o.user_id)
    const address = o.address_id ? addressMap.get(o.address_id) : null
    const state = address?.state ?? null
    // Determine KL: try state first, then postcode
    const postcode = address?.postcode ?? extractPostcode(o.delivery_address)
    const isKlByState = state ? KL_STATES.has(state) : null
    const isKlByPostcode = postcode ? isKlPostcode(postcode) : null
    const is_kl = isKlByState ?? isKlByPostcode ?? false
    const area_known = isKlByState !== null || isKlByPostcode !== null
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
      recipient_name: address?.recipient_name ?? profile?.full_name ?? null,
      recipient_phone: address?.recipient_phone ?? profile?.phone ?? null,
      items: itemsMap.get(o.id) ?? [],
    }
  })
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
  const [orders, lpOrdersRes] = await Promise.all([
    getOrders(fromISO, toISO),
    supabaseAdmin.from('lp_guest_orders')
      .select('id, order_number, name, phone, address, postcode, notes, status, total, payment_method, created_at, items, product_name, variant_name, quantity, unit_price')
      .in('status', ['confirmed', 'preparing', 'delivering'])
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: false }),
  ])

  // Transform LP orders to ExportOrder shape
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

  const lpOrders: typeof orders = (lpOrdersRes.data ?? []).map((lp: any) => {
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
      payment_status: ['fpx', 'ewallet'].includes(lp.payment_method) ? 'paid' : 'unpaid',
      total: lp.total,
      notes: lp.notes ?? null,
      created_at: lp.created_at,
      full_name: lp.name,
      phone: lp.phone,
      email: null,
      full_address: lp.address ?? null,
      city: null,
      postcode,
      state: null,
      is_kl: isKlPostcode(postcode),
      area_known: !!postcode,
      has_fresh: true,
      recipient_name: lp.name,
      recipient_phone: lp.phone,
      items,
    }
  })

  const allOrders = [...orders, ...lpOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return <ExportsClient orders={allOrders} defaultFrom={fromDate} defaultTo={toDate} />
}
