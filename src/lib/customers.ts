import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/phone'

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
// Ini logik sama dengan scripts/backfill-customers.mjs, dipanggil oleh cron
// harian supaya nombor CRM tak basi antara backfill manual. [[lib/customers.ts]]
const DEAD_STATUS = new Set(['cancelled', 'refunded'])

export async function refreshCustomerAggregates(): Promise<{
  customers: number; withOrders: number; totalSpend: number; written: number; failed: number
}> {
  const supabase = createAdminClient()

  type Person = {
    phone_norm: string; name: string | null; email: string | null; address: string | null
    postcode: string | null; user_id: string | null; sources: Set<string>
    order_count: number; total_spend: number; last_order_at: string | null; first_seen_at: string | null
  }
  const map = new Map<string, Person>()
  const touch = (phone: string | null | undefined): Person | null => {
    const k = normalizePhone(phone); if (!k) return null
    let p = map.get(k)
    if (!p) { p = { phone_norm: k, name: null, email: null, address: null, postcode: null, user_id: null, sources: new Set(), order_count: 0, total_spend: 0, last_order_at: null, first_seen_at: null }; map.set(k, p) }
    return p
  }
  const fill = (p: Person, f: 'name' | 'email' | 'address' | 'postcode', v: string | null | undefined) => { if (v && !p[f]) p[f] = v }
  const seen = (p: Person, t: string | null | undefined) => { if (t && (!p.first_seen_at || new Date(t) < new Date(p.first_seen_at))) p.first_seen_at = t }
  const ordered = (p: Person, t: string | null | undefined) => { if (t && (!p.last_order_at || new Date(t) > new Date(p.last_order_at))) p.last_order_at = t }

  // profiles (registered)
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone, email, created_at').eq('is_admin', false)
  const profileById = new Map<string, { phone: string | null }>()
  for (const pr of profiles ?? []) {
    profileById.set(pr.id, { phone: pr.phone })
    const p = touch(pr.phone); if (!p) continue
    p.sources.add('store'); p.user_id = pr.id
    fill(p, 'name', pr.full_name); fill(p, 'email', pr.email); seen(p, pr.created_at)
  }

  // storefront orders → key ikut telefon profil
  const { data: orders } = await supabase.from('orders').select('user_id, total, status, created_at')
  for (const o of orders ?? []) {
    const pr = profileById.get(o.user_id); if (!pr?.phone) continue
    const p = touch(pr.phone); if (!p) continue
    p.sources.add('store'); seen(p, o.created_at)
    if (!DEAD_STATUS.has(o.status)) { p.order_count++; p.total_spend += Number(o.total || 0); ordered(p, o.created_at) }
  }

  // LP guest orders
  const { data: lp } = await supabase.from('lp_guest_orders').select('phone, name, email, address, postcode, total, status, created_at')
  for (const o of lp ?? []) {
    const p = touch(o.phone); if (!p) continue
    p.sources.add('lp')
    fill(p, 'name', o.name); fill(p, 'email', o.email); fill(p, 'address', o.address); fill(p, 'postcode', o.postcode)
    seen(p, o.created_at)
    if (!DEAD_STATUS.has(o.status)) { p.order_count++; p.total_spend += Number(o.total || 0); ordered(p, o.created_at) }
  }

  // leads (belum beli)
  const { data: leads } = await supabase.from('landing_page_leads').select('name, phone, created_at')
  for (const l of leads ?? []) {
    const p = touch(l.phone); if (!p) continue
    p.sources.add('lead'); fill(p, 'name', l.name); seen(p, l.created_at)
  }

  const people = [...map.values()].map(p => ({ ...p, total_spend: Math.round(p.total_spend * 100) / 100 }))

  // Baris sedia ada → kemas AGREGAT sahaja (jangan tindih name/email/address yang
  // mungkin admin dah betulkan, dan jangan sentuh tags/is_reseller/consent).
  // Baris baharu (telefon tiada lagi) → insert penuh.
  const { data: existing } = await supabase.from('customers').select('id, phone_norm, sources')
  const existingByPhone = new Map((existing ?? []).map(r => [r.phone_norm as string, r as { id: string; sources: string[] }]))

  let written = 0, failed = 0
  const inserts: Record<string, unknown>[] = []

  for (const p of people) {
    const ex = existingByPhone.get(p.phone_norm)
    if (!ex) {
      inserts.push({
        phone_norm: p.phone_norm, name: p.name, email: p.email, address: p.address, postcode: p.postcode,
        user_id: p.user_id, sources: [...p.sources], order_count: p.order_count,
        total_spend: p.total_spend, last_order_at: p.last_order_at, first_seen_at: p.first_seen_at,
      })
      continue
    }
    const mergedSources = [...new Set([...(ex.sources ?? []), ...p.sources])]
    const { error } = await supabase.from('customers').update({
      order_count: p.order_count, total_spend: p.total_spend,
      last_order_at: p.last_order_at, sources: mergedSources, updated_at: new Date().toISOString(),
    }).eq('id', ex.id)
    if (error) { failed++; console.error('[customers] refresh update error:', error.message) } else written++
  }

  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200)
    const { error } = await supabase.from('customers').insert(chunk)
    if (error) { failed += chunk.length; console.error('[customers] refresh insert error:', error.message) } else written += chunk.length
  }

  return {
    customers: people.length,
    withOrders: people.filter(p => p.order_count > 0).length,
    totalSpend: Math.round(people.reduce((s, p) => s + p.total_spend, 0) * 100) / 100,
    written, failed,
  }
}
