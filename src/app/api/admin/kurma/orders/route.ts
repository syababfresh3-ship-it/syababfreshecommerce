import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { quoteGift, depositFor, DEFAULT_DEPOSIT_PCT, type GiftCatalog, type GiftConfig } from '@/lib/gift'

// Gift orders — admin (migration 137).
// GET  ?status=            → senarai tempahan (terkini dahulu)
// POST { ...customer, config, deposit_pct?, total?, status? } → key-in manual
//   total diberi → guna sebagai sebut harga admin; jika tidak, kira dari katalog.

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const status = new URL(request.url).searchParams.get('status')
  let q = supabase!.from('gift_orders').select('*').order('created_at', { ascending: false }).limit(300)
  if (status && status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => ({}))
  const name = String(body.name ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  if (name.length < 2 || phone.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'Nama & telefon diperlukan' }, { status: 400 })

  const cfg = body.config ?? {}
  const config: GiftConfig = {
    box_id: String(cfg.box_id ?? ''),
    weight: cfg.weight ? String(cfg.weight) : null,
    finishing: cfg.finishing ? String(cfg.finishing) : null,
    design_id: cfg.design_id ? String(cfg.design_id) : null,
    custom_design_url: cfg.custom_design_url ? String(cfg.custom_design_url) : null,
    diecut_url: cfg.diecut_url ? String(cfg.diecut_url) : null,
    fillings: Array.isArray(cfg.fillings) ? cfg.fillings.map((f: { id: unknown; qty: unknown }) => ({ id: String(f.id), qty: Math.max(0, Math.floor(Number(f.qty) || 0)) })).filter((f: { id: string }) => f.id) : [],
    quantity: Math.max(1, Math.floor(Number(cfg.quantity) || 1)),
  }

  // Kira dari katalog (kalau ada box), tapi admin boleh override total.
  let unitPrice = 0, subtotal = 0, quantity = config.quantity
  if (config.box_id) {
    const [boxes, fillings, designs] = await Promise.all([
      supabase!.from('gift_boxes').select('*').eq('is_active', true),
      supabase!.from('gift_fillings').select('*').eq('is_active', true),
      supabase!.from('gift_designs').select('*').eq('is_active', true),
    ])
    const catalog: GiftCatalog = { boxes: boxes.data ?? [], fillings: fillings.data ?? [], designs: designs.data ?? [] }
    const qn = quoteGift(catalog, config)
    if (qn.ok) { unitPrice = qn.unitPrice; subtotal = qn.subtotal; quantity = qn.quantity }
  }
  const total = body.total !== undefined && body.total !== '' ? Math.max(0, Number(body.total)) : subtotal
  const depositPct = Math.min(100, Math.max(10, Math.floor(Number(body.deposit_pct) || DEFAULT_DEPOSIT_PCT)))
  const { deposit, balance } = depositFor(total, depositPct)

  const { data: orderNumber } = await supabase!.rpc('generate_gift_order_number')
  const status = ['enquiry', 'quoted', 'confirmed', 'in_production', 'ready', 'completed'].includes(body.status) ? body.status : 'quoted'
  const row = {
    order_number: orderNumber, channel: 'manual',
    name, phone, email: body.email ? String(body.email).trim() : null,
    company: body.company ? String(body.company).trim() : null,
    address: body.address ? String(body.address).trim() : null,
    postcode: body.postcode ? String(body.postcode).trim() : null,
    delivery_method: body.delivery_method === 'pickup' ? 'pickup' : 'delivery',
    config, custom_design_url: config.custom_design_url,
    quantity, unit_price: unitPrice, subtotal, delivery_fee: 0, total,
    deposit_pct: depositPct, deposit_amount: deposit, balance,
    payment_status: 'unpaid', status,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    admin_notes: body.admin_notes ? String(body.admin_notes).slice(0, 2000) : null,
    created_by: user!.id,
  }
  const { data, error } = await supabase!.from('gift_orders').insert(row).select('id, order_number').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
