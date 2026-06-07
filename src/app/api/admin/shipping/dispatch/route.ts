import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Auth admin + pulang user (untuk scanned_by). requireAdmin sedia ada tak pulang user.
async function authAdmin() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { user: null, admin: null, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { user: null, admin: null, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, admin, res: null as null }
}

// Mula hari ini ikut zon Malaysia (UTC+8), dipulang sebagai ISO UTC
function startOfTodayMyIso(): string {
  const my = new Date(Date.now() + 8 * 3600_000)
  return new Date(Date.UTC(my.getUTCFullYear(), my.getUTCMonth(), my.getUTCDate()) - 8 * 3600_000).toISOString()
}

// POST — scan satu order keluar. order_number berawalan 'LP-' → lp_guest_orders, lain → orders.
export async function POST(request: Request) {
  const { user, admin, res } = await authAdmin()
  if (res) return res

  const body = await request.json().catch(() => null)
  const raw = String(body?.order_number ?? '').trim().toUpperCase()
  if (!raw) return NextResponse.json({ error: 'order_number required' }, { status: 400 })

  // Lookup — shop dulu, lepas tu LP
  let source: 'shop' | 'lp' | null = null
  let orderId: string | null = null
  let name = ''
  let courier: string | null = null
  let itemCount = 0
  let status = ''

  const { data: shopOrder } = await admin
    .from('orders').select('id, status, user_id').eq('order_number', raw).maybeSingle()
  if (shopOrder) {
    source = 'shop'; orderId = shopOrder.id; status = shopOrder.status
    const [{ data: prof }, { count }, { data: ship }] = await Promise.all([
      shopOrder.user_id
        ? admin.from('profiles').select('full_name').eq('id', shopOrder.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', shopOrder.id),
      admin.from('order_shipments').select('carrier_id').eq('order_id', shopOrder.id).maybeSingle(),
    ])
    name = (prof as { full_name?: string } | null)?.full_name ?? ''
    itemCount = count ?? 0
    courier = ship?.carrier_id ?? null
  } else {
    const { data: lp } = await admin
      .from('lp_guest_orders').select('id, status, name, courier_id').eq('order_number', raw).maybeSingle()
    if (lp) { source = 'lp'; orderId = lp.id; status = lp.status; name = lp.name ?? ''; courier = lp.courier_id ?? null }
  }

  if (!source) return NextResponse.json({ error: 'not_found', order_number: raw }, { status: 404 })

  const order = { order_number: raw, name, source, courier, item_count: itemCount }

  // Idempotent — kalau dah discan, pulang info (bukan error)
  const { data: existing } = await admin
    .from('order_dispatches').select('id, scanned_at').eq('order_number', raw).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, already: true, order, scanned_at: existing.scanned_at })

  const { error: insErr } = await admin.from('order_dispatches').insert({
    order_id: orderId, source, order_number: raw, scanned_by: user.id,
    courier, photo_url: body?.photo_url ?? null, notes: body?.notes ?? null,
  })
  if (insErr) {
    if (insErr.code === '23505') return NextResponse.json({ ok: true, already: true, order }) // race
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Safety net — kalau status belum delivering (confirmed/preparing), majukan.
  // Jangan sentuh kalau dah delivered/cancelled/refunded.
  if (['confirmed', 'preparing'].includes(status)) {
    const now = new Date().toISOString()
    const table = source === 'shop' ? 'orders' : 'lp_guest_orders'
    await admin.from(table).update({ status: 'delivering', delivering_at: now }).eq('id', orderId)
  }

  return NextResponse.json({ ok: true, already: false, order })
}

// GET — ringkasan scan hari ini (untuk skrin: kiraan + senarai terkini)
export async function GET() {
  const { admin, res } = await authAdmin()
  if (res) return res
  const start = startOfTodayMyIso()
  const { data, count } = await admin
    .from('order_dispatches')
    .select('order_number, source, courier, scanned_at', { count: 'exact' })
    .gte('scanned_at', start)
    .order('scanned_at', { ascending: false })
    .limit(50)
  return NextResponse.json({ count: count ?? 0, recent: data ?? [] })
}
