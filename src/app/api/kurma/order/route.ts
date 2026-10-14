import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { sendAdminEmail } from '@/lib/zeptomail'
import { quoteGift, depositFor, DEFAULT_DEPOSIT_PCT, type GiftCatalog, type GiftConfig } from '@/lib/gift'
import { createGiftCheckout } from '@/lib/gift-chip'

// POST /api/kurma/order — cipta tempahan Gift Studio.
// Body: { name, phone, email?, company?, address?, postcode?, delivery_method,
//         config: {box_id, design_id?, custom_design_url?, fillings:[{id,qty}], quantity},
//         notes?, mode: 'deposit' | 'enquiry', deposit_pct? }
// mode 'deposit' → cipta purchase CHIP untuk deposit, pulang { checkoutUrl }.
// mode 'enquiry' → status enquiry, email admin, pulang { order_number }.
// Harga DIKIRA SEMULA server-side dari katalog (jangan percaya klien). Lihat lib/gift.ts.
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!(await rateLimitDb(`gift-order:${ip}`, 8, 60_000))) {
    return NextResponse.json({ error: 'Terlalu banyak percubaan, cuba sebentar lagi' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })

  const name = String(body.name ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const email = body.email ? String(body.email).trim() : null
  const mode = body.mode === 'deposit' ? 'deposit' : 'enquiry'
  if (name.length < 2) return NextResponse.json({ error: 'Nama diperlukan' }, { status: 400 })
  if (phone.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'No. telefon tidak sah' }, { status: 400 })

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
  if (!config.box_id) return NextResponse.json({ error: 'Sila pilih kotak' }, { status: 400 })

  const sb = createAdminClient()
  const [boxes, fillings, designs] = await Promise.all([
    sb.from('gift_boxes').select('*').eq('is_active', true),
    sb.from('gift_fillings').select('*').eq('is_active', true),
    sb.from('gift_designs').select('*').eq('is_active', true),
  ])
  const catalog: GiftCatalog = { boxes: boxes.data ?? [], fillings: fillings.data ?? [], designs: designs.data ?? [] }
  const q = quoteGift(catalog, config)
  if (!q.ok) return NextResponse.json({ error: q.error ?? 'Konfigurasi tidak sah' }, { status: 400 })

  const total = q.subtotal   // delivery_fee = 0 di peringkat online; admin boleh laras kemudian
  const depositPct = Math.min(100, Math.max(10, Math.floor(Number(body.deposit_pct) || DEFAULT_DEPOSIT_PCT)))
  const { deposit, balance } = depositFor(total, depositPct)

  const { data: orderNumber } = await sb.rpc('generate_gift_order_number')
  const row = {
    order_number: orderNumber,
    channel: 'online',
    name, phone, email,
    company: body.company ? String(body.company).trim() : null,
    address: body.address ? String(body.address).trim() : null,
    postcode: body.postcode ? String(body.postcode).trim() : null,
    delivery_method: body.delivery_method === 'pickup' ? 'pickup' : 'delivery',
    config,
    custom_design_url: config.custom_design_url,
    quantity: q.quantity,
    unit_price: q.unitPrice,
    subtotal: q.subtotal,
    delivery_fee: 0,
    total,
    deposit_pct: depositPct,
    deposit_amount: deposit,
    balance,
    payment_status: 'unpaid',
    status: mode === 'deposit' ? 'quoted' : 'enquiry',
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
  }
  const { data: order, error } = await sb.from('gift_orders').insert(row).select('id, order_number').single()
  if (error || !order) return NextResponse.json({ error: error?.message ?? 'Gagal cipta tempahan' }, { status: 500 })

  if (mode === 'deposit') {
    const res = await createGiftCheckout({ id: order.id, order_number: order.order_number, name, phone, email }, 'deposit', deposit)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: 502 })
    return NextResponse.json({ ok: true, order_number: order.order_number, checkoutUrl: res.url, deposit, total })
  }

  // Enquiry — beritahu admin
  const box = q.box!
  await sendAdminEmail({
    subject: `Enquiry gift baharu — ${order.order_number} (${name})`,
    html: `<h2>Enquiry Gift Studio</h2>
      <p><b>${order.order_number}</b> · ${name} · ${phone}${email ? ` · ${email}` : ''}${row.company ? ` · ${row.company}` : ''}</p>
      <p>Kotak: <b>${box.name}</b> · Kuantiti: <b>${q.quantity}</b> · Anggaran: <b>RM${total.toFixed(2)}</b> (deposit RM${deposit.toFixed(2)})</p>
      ${config.custom_design_url ? `<p>Design customer: <a href="${config.custom_design_url}">lihat</a></p>` : ''}
      ${row.notes ? `<p>Nota: ${row.notes}</p>` : ''}
      <p>Buka di admin → Gift Orders untuk sebut harga & key-in.</p>`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, order_number: order.order_number, mode: 'enquiry', total, deposit })
}
