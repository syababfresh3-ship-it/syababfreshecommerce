import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/phone'
import { fetchAll } from '@/lib/supabase/fetch-all'

// Master-customer upsert (CRM). Dipanggil dari setiap titik tulis yang cipta
// kenalan/order (order LP, lead, order storefront). Padan ikut phone_norm:
// satu orang = satu baris, gabung `sources`, isi medan kosong, segar recency.
//
// PENTING — pembahagian tanggungjawab:
//   • Path berterusan ini = IDENTITI + sources + last_order_at (recency) sahaja.
//   • Agregat order_count/total_spend dimiliki oleh backfill (kira semula
//     autoritatif ikut penapis status setiap saluran) supaya tiada double-count
//     dari order unpaid/abandoned. Re-run backfill untuk segar agregat.
//
// Best-effort: TAK PERNAH throw — kalau gagal (cth table belum dimigrate), senyap.

export type CustomerSource = 'store' | 'lp' | 'lead' | 'tiktok' | 'whatsapp' | 'web' | 'manual'

export async function upsertCustomer(input: {
  phone: string | null | undefined
  source: CustomerSource
  name?: string | null
  email?: string | null
  address?: string | null
  postcode?: string | null
  userId?: string | null
  // Masa order — majukan last_order_at (recency untuk segmen). Tiada = lead/kenalan.
  lastOrderAt?: string | null
}): Promise<void> {
  try {
    const phone_norm = normalizePhone(input.phone)
    if (!phone_norm) return // tiada identiti → langkau senyap

    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const seenAt = input.lastOrderAt ?? now

    const { data: existing } = await supabase
      .from('customers')
      .select('id, sources, name, email, address, postcode, user_id, last_order_at, first_seen_at')
      .eq('phone_norm', phone_norm)
      .maybeSingle()

    if (!existing) {
      await supabase.from('customers').insert({
        phone_norm,
        name: input.name || null,
        email: input.email || null,
        address: input.address || null,
        postcode: input.postcode || null,
        user_id: input.userId || null,
        sources: [input.source],
        last_order_at: input.lastOrderAt || null,
        first_seen_at: seenAt,
      })
      return
    }

    // Gabung — isi medan kosong sahaja (jangan timpa data sedia ada yang lebih baik)
    const sources = Array.from(new Set([...(existing.sources ?? []), input.source]))
    const patch: Record<string, unknown> = { sources, updated_at: now }
    if (!existing.name && input.name) patch.name = input.name
    if (!existing.email && input.email) patch.email = input.email
    if (!existing.address && input.address) patch.address = input.address
    if (!existing.postcode && input.postcode) patch.postcode = input.postcode
    if (!existing.user_id && input.userId) patch.user_id = input.userId

    if (input.lastOrderAt && (!existing.last_order_at || new Date(input.lastOrderAt) > new Date(existing.last_order_at)))
      patch.last_order_at = input.lastOrderAt
    if (!existing.first_seen_at || new Date(seenAt) < new Date(existing.first_seen_at))
      patch.first_seen_at = seenAt

    await supabase.from('customers').update(patch).eq('id', existing.id)
  } catch (err) {
    console.error('[customers] upsert failed (non-fatal):', err)
  }
}

// ── Segar agregat autoritatif (order_count / total_spend / recency) ──────────
// Kira semula dari sumber sebenar (profiles + orders + lp_guest_orders + leads),
// dedup ikut phone_norm, kira hanya order yang BUKAN cancelled/refunded supaya
// tiada double-count dari order unpaid/abandoned. Upsert ikut phone_norm dan
// SENGAJA tak hantar tags / is_reseller / consent (jadi nilai admin kekal).
// Dipanggil oleh cron harian `refresh-customers` dan POST /api/admin/database/refresh
// (butang "Segarkan sekarang"). scripts/backfill-customers.mjs ialah versi LAMA
// (tiada paginasi, tindih medan identiti) — jangan guna; ia dikekalkan untuk rujukan.
//
// Sejak migration 134, fungsi ini juga mengisi product_names, coupon_codes,
// coupon_count dan first_order_at — semuanya dari order yang lulus counts() sahaja,
// supaya coupon_count <= order_count dan first_order_at <= last_order_at sentiasa.
const DEAD_STATUS = new Set(['cancelled', 'refunded'])

export async function refreshCustomerAggregates(): Promise<{
  customers: number; withOrders: number; withProducts: number; withCoupons: number
  totalSpend: number; written: number; failed: number
}> {
  const supabase = createAdminClient()

  type Person = {
    phone_norm: string; name: string | null; email: string | null; address: string | null
    postcode: string | null; user_id: string | null; sources: Set<string>
    order_count: number; total_spend: number; last_order_at: string | null; first_seen_at: string | null
    // migration 134 — fakta beli
    products: Set<string>; coupons: Set<string>; coupon_count: number; first_order_at: string | null
  }
  const map = new Map<string, Person>()
  const touch = (phone: string | null | undefined): Person | null => {
    const k = normalizePhone(phone); if (!k) return null
    let p = map.get(k)
    if (!p) { p = { phone_norm: k, name: null, email: null, address: null, postcode: null, user_id: null, sources: new Set(), order_count: 0, total_spend: 0, last_order_at: null, first_seen_at: null, products: new Set(), coupons: new Set(), coupon_count: 0, first_order_at: null }; map.set(k, p) }
    return p
  }
  const fill = (p: Person, f: 'name' | 'email' | 'address' | 'postcode', v: string | null | undefined) => { if (v && !p[f]) p[f] = v }
  const seen = (p: Person, t: string | null | undefined) => { if (t && (!p.first_seen_at || new Date(t) < new Date(p.first_seen_at))) p.first_seen_at = t }
  const ordered = (p: Person, t: string | null | undefined) => { if (t && (!p.last_order_at || new Date(t) > new Date(p.last_order_at))) p.last_order_at = t }
  const firstOrdered = (p: Person, t: string | null | undefined) => { if (t && (!p.first_order_at || new Date(t) < new Date(p.first_order_at))) p.first_order_at = t }
  // Embed PostgREST: to-one (promo_codes) pulang objek, tetapi tahan kalau ia array.
  const codeOf = (pc: unknown): string | null => {
    const x = Array.isArray(pc) ? pc[0] : pc
    const c = (x as { code?: unknown } | null)?.code
    return typeof c === 'string' && c.trim() ? c.trim() : null
  }
  // Dedup ikut product_name SAHAJA (tanpa variant) — supaya dropdown penapis tak meletup.
  const addProducts = (p: Person, names: Array<string | null | undefined>) => {
    for (const nm of names) { const t = (nm ?? '').trim(); if (t) p.products.add(t) }
  }
  const addCoupon = (p: Person, pc: unknown) => {
    const code = codeOf(pc); if (code) { p.coupons.add(code); p.coupon_count++ }
  }

  // Semua select di bawah guna fetchAll — PostgREST cap 1000 baris/permintaan;
  // dulu select tanpa .range() diam-diam terpotong → agregat salah bila >1000 baris.
  // profiles (registered)
  type ProfileRow = { id: string; full_name: string | null; phone: string | null; email: string | null; created_at: string }
  const profiles = await fetchAll<ProfileRow>((f, t) =>
    supabase.from('profiles').select('id, full_name, phone, email, created_at').eq('is_admin', false).order('id').range(f, t),
    'customers:profiles')
  const profileById = new Map<string, { phone: string | null }>()
  for (const pr of profiles) {
    profileById.set(pr.id, { phone: pr.phone })
    const p = touch(pr.phone); if (!p) continue
    p.sources.add('store'); p.user_id = pr.id
    fill(p, 'name', pr.full_name); fill(p, 'email', pr.email); seen(p, pr.created_at)
  }

  // Order dikira hanya kalau (a) bukan cancelled/refunded DAN (b) "settled":
  // online (fpx/ewallet) mesti dah paid; COD/bank transfer dikira (bayar masa hantar).
  // Tanpa (b), order online abandoned (belum bayar) akan kembungkan order_count/spend.
  const counts = (o: { status: string; payment_method?: string | null; payment_status?: string | null }) =>
    !DEAD_STATUS.has(o.status) &&
    (['fpx', 'ewallet'].includes(o.payment_method ?? '') ? o.payment_status === 'paid' : true)

  // storefront orders → key ikut telefon profil
  // Embed order_items + promo_codes (FK tunggal, tidak samar — preseden admin/promos/usage).
  type OrderRow = {
    id: string; user_id: string; total: number | null; status: string; payment_method: string | null; payment_status: string | null; created_at: string
    order_items: { product_name: string | null }[] | null
    promo_codes: { code: string } | { code: string }[] | null
  }
  const orders = await fetchAll<OrderRow>((f, t) =>
    supabase.from('orders').select('id, user_id, total, status, payment_method, payment_status, created_at, order_items(product_name), promo_codes(code)').order('id').range(f, t),
    'customers:orders')
  for (const o of orders) {
    const pr = profileById.get(o.user_id); if (!pr?.phone) continue
    const p = touch(pr.phone); if (!p) continue
    p.sources.add('store'); seen(p, o.created_at)
    if (counts(o)) {
      p.order_count++; p.total_spend += Number(o.total || 0); ordered(p, o.created_at); firstOrdered(p, o.created_at)
      addProducts(p, (o.order_items ?? []).map(i => i.product_name)); addCoupon(p, o.promo_codes)
    }
  }

  // LP guest orders
  type LpRow = {
    phone: string | null; name: string | null; email: string | null; address: string | null; postcode: string | null
    total: number | null; status: string; payment_method: string | null; payment_status: string | null; created_at: string
    // items jsonb (043) atau skalar legasi product_name (pra-043) — corak daily-summary.ts
    items: unknown; product_name: string | null
    promo_codes: { code: string } | { code: string }[] | null
  }
  const lpItemNames = (o: LpRow): Array<string | null | undefined> => {
    if (Array.isArray(o.items) && o.items.length > 0) {
      return (o.items as Array<{ product_name?: string | null; name?: string | null }>).map(i => i?.product_name ?? i?.name)
    }
    return [o.product_name]
  }
  const lp = await fetchAll<LpRow>((f, t) =>
    supabase.from('lp_guest_orders').select('phone, name, email, address, postcode, total, status, payment_method, payment_status, created_at, items, product_name, promo_codes(code)').order('id').range(f, t),
    'customers:lp')
  for (const o of lp) {
    const p = touch(o.phone); if (!p) continue
    p.sources.add('lp')
    fill(p, 'name', o.name); fill(p, 'email', o.email); fill(p, 'address', o.address); fill(p, 'postcode', o.postcode)
    seen(p, o.created_at)
    if (counts(o)) {
      p.order_count++; p.total_spend += Number(o.total || 0); ordered(p, o.created_at); firstOrdered(p, o.created_at)
      addProducts(p, lpItemNames(o)); addCoupon(p, o.promo_codes)
    }
  }

  // leads (belum beli)
  const leads = await fetchAll<{ name: string | null; phone: string | null; created_at: string }>((f, t) =>
    supabase.from('landing_page_leads').select('name, phone, created_at').order('id').range(f, t),
    'customers:leads')
  for (const l of leads) {
    const p = touch(l.phone); if (!p) continue
    p.sources.add('lead'); fill(p, 'name', l.name); seen(p, l.created_at)
  }

  const people = [...map.values()].map(p => ({
    ...p,
    total_spend: Math.round(p.total_spend * 100) / 100,
    product_names: [...p.products].sort(),
    coupon_codes: [...p.coupons].sort(),
  }))

  // Baris sedia ada → kemas AGREGAT sahaja (jangan tindih name/email/address yang
  // mungkin admin dah betulkan, dan jangan sentuh tags/is_reseller/consent).
  // Baris baharu (telefon tiada lagi) → insert penuh.
  const existing = await fetchAll<{ id: string; phone_norm: string; sources: string[] | null }>((f, t) =>
    supabase.from('customers').select('id, phone_norm, sources').order('id').range(f, t),
    'customers:existing')
  const existingByPhone = new Map(existing.map(r => [r.phone_norm, r]))

  const now = new Date().toISOString()
  let written = 0, failed = 0
  const inserts: Record<string, unknown>[] = []
  const updates: Record<string, unknown>[] = []

  for (const p of people) {
    const ex = existingByPhone.get(p.phone_norm)
    if (!ex) {
      inserts.push({
        phone_norm: p.phone_norm, name: p.name, email: p.email, address: p.address, postcode: p.postcode,
        user_id: p.user_id, sources: [...p.sources], order_count: p.order_count,
        total_spend: p.total_spend, last_order_at: p.last_order_at, first_seen_at: p.first_seen_at,
        product_names: p.product_names, coupon_codes: p.coupon_codes, coupon_count: p.coupon_count, first_order_at: p.first_order_at,
      })
      continue
    }
    // Kemas AGREGAT + sources sahaja. Upsert by phone_norm cuma tindih lajur yang
    // dihantar → name/email/address/tags/is_reseller/consent/first_seen_at kekal.
    updates.push({
      phone_norm: p.phone_norm,
      order_count: p.order_count,
      total_spend: p.total_spend,
      last_order_at: p.last_order_at,
      sources: [...new Set([...(ex.sources ?? []), ...p.sources])],
      // migration 134 — fakta beli (cache agregat, sama sifat dengan order_count)
      product_names: p.product_names,
      coupon_codes: p.coupon_codes,
      coupon_count: p.coupon_count,
      first_order_at: p.first_order_at,
      updated_at: now,
    })
  }

  // Bulk upsert (chunk) — ganti gelung update satu-satu yang dulu buat N round-trip
  // berturutan (timeout pada ratusan customer). Kini ~ceil(N/500) round-trip.
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500)
    const { error } = await supabase.from('customers').upsert(chunk, { onConflict: 'phone_norm' })
    if (error) { failed += chunk.length; console.error('[customers] refresh upsert error:', error.message) } else written += chunk.length
  }

  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200)
    const { error } = await supabase.from('customers').insert(chunk)
    if (error) { failed += chunk.length; console.error('[customers] refresh insert error:', error.message) } else written += chunk.length
  }

  return {
    customers: people.length,
    withOrders: people.filter(p => p.order_count > 0).length,
    withProducts: people.filter(p => p.product_names.length > 0).length,
    withCoupons: people.filter(p => p.coupon_count > 0).length,
    totalSpend: Math.round(people.reduce((s, p) => s + p.total_spend, 0) * 100) / 100,
    written, failed,
  }
}
