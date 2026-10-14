import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { isHoneypotFilled } from '@/lib/order-guard'
import { sendAdminEmail } from '@/lib/zeptomail'
import { depositFor, DEFAULT_DEPOSIT_PCT, FINISHES } from '@/lib/gift'
import { sheetQuote, SHEET_VERSION } from '@/lib/gift-pricing'
import { clampTransform } from '@/lib/gift-mockup'

// POST /api/kurma/enquiry — enquiry dari Studio hot-lead (/kurma/studio): pilihan sheet 2026
// (kurma × berat × qty) + template/logo/mockup → SIMPAN ke gift_orders (status 'enquiry'),
// e-mel admin, pulang no. rujukan; klien kemudian terus ke WhatsApp dgn no. itu.
//
// Berasingan dari /api/kurma/order (katalog box_id + quoteGift) — tak disentuh. Harga DIKIRA
// SEMULA di server dari lib/gift-pricing.ts (jangan percaya klien). Pilihan sheet disimpan
// dalam config jsonb {source:'sheet', ...}; lajur migration 143 (list_unit_price) diisi bila ada.
export const runtime = 'nodejs'

const MISSING_COLUMN = new Set(['42703', 'PGRST204'])
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FINISH_CODES = new Set<string>(FINISHES.map(f => f.code))

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))

/** Hanya URL dari bucket awam kita sendiri — elak pautan luar disimpan & dipaparkan di admin. */
function ownStorageUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v || v.length > 500) return null
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/brand-assets/`
  return base.length > 40 && v.startsWith(base) ? v : null
}

function fakeGiftNumber() {
  const d = new Date(); const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `GIFT-${ymd}-${1000 + Math.floor(Math.random() * 9000)}`
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!(await rateLimitDb(`gift-enquiry:${ip}`, 8, 60_000))) {
    return NextResponse.json({ error: 'Terlalu banyak percubaan, cuba sebentar lagi' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })

  // Honeypot diisi = bot → balas "berjaya" palsu (bot tak belajar apa-apa), tiada DB.
  if (isHoneypotFilled(body)) {
    console.warn(`[order-guard] honeypot hit (gift-enquiry) ip=${ip}`)
    const q = sheetQuote({ kurmaId: body.kurmaId, weight: body.weight, qty: body.qty })
    return NextResponse.json({ ok: true, order_number: fakeGiftNumber(), total: q.ok ? q.total : 0 })
  }

  const name = str(body.name, 120)
  const phone = str(body.phone, 30)
  const emailRaw = str(body.email, 160)
  const company = str(body.company, 160) || null
  const notes = str(body.notes, 2000) || null
  const sourceUtm = str(body.source_utm, 120) || null
  if (name.length < 2) return NextResponse.json({ error: 'Nama diperlukan' }, { status: 400 })
  if (phone.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'No. telefon tidak sah' }, { status: 400 })
  if (emailRaw && !EMAIL_RE.test(emailRaw)) return NextResponse.json({ error: 'Email tidak sah' }, { status: 400 })
  const email = emailRaw || null
  const finishing = typeof body.finishing === 'string' && FINISH_CODES.has(body.finishing) ? body.finishing : null

  // Harga — kira semula dari sheet (server). qty cap munasabah.
  const q = sheetQuote({ kurmaId: body.kurmaId, weight: body.weight, qty: Math.min(100_000, Number(body.qty)) })
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: 400 })

  const sb = createAdminClient()

  // Template (pilihan) — mesti wujud & aktif
  let template: { id: string; name: string } | null = null
  if (body.template_id !== undefined && body.template_id !== null && body.template_id !== '') {
    const tid = String(body.template_id)
    if (!UUID_RE.test(tid)) return NextResponse.json({ error: 'Template tidak dijumpai' }, { status: 400 })
    const { data: t } = await sb.from('gift_designs').select('id, name').eq('id', tid).eq('is_active', true).maybeSingle()
    if (!t) return NextResponse.json({ error: 'Template tidak dijumpai' }, { status: 400 })
    template = t
  }

  // URL fail — hanya bucket kita
  const urlOrNull = (v: unknown, label: string): string | null | 'bad' => {
    if (v === undefined || v === null || v === '') return null
    const u = ownStorageUrl(v); return u ?? 'bad'
  }
  const logoUrl = urlOrNull(body.logo_url, 'logo'); if (logoUrl === 'bad') return NextResponse.json({ error: 'URL fail tidak sah' }, { status: 400 })
  const mockupUrl = urlOrNull(body.mockup_url, 'mockup'); if (mockupUrl === 'bad') return NextResponse.json({ error: 'URL fail tidak sah' }, { status: 400 })
  const fullDesignUrl = urlOrNull(body.full_design_url, 'design'); if (fullDesignUrl === 'bad') return NextResponse.json({ error: 'URL fail tidak sah' }, { status: 400 })
  const logoTransform = body.logo_transform && typeof body.logo_transform === 'object' ? clampTransform(body.logo_transform) : null

  // Dedup 2 minit: telefon + pilihan sama → pulang rekod sedia ada (klik berganda / refresh)
  const since = new Date(Date.now() - 2 * 60_000).toISOString()
  const { data: recent } = await sb.from('gift_orders').select('id, order_number, total, quantity, unit_price, deposit_amount, config')
    .eq('phone', phone).gte('created_at', since).order('created_at', { ascending: false }).limit(5)
  const dup = (recent ?? []).find(r => {
    const c = (r.config ?? {}) as Record<string, unknown>
    return c.source === 'sheet' && c.kurma_id === q.kurma.id && c.weight === q.weight && Number(r.quantity) === q.qty
  })
  if (dup) {
    return NextResponse.json({ ok: true, duplicate: true, order_number: dup.order_number, total: Number(dup.total), per_box: Number(dup.unit_price), qty: Number(dup.quantity), deposit: Number(dup.deposit_amount) })
  }

  const { deposit, balance } = depositFor(q.total, DEFAULT_DEPOSIT_PCT)
  const { data: orderNumber } = await sb.rpc('generate_gift_order_number')
  const config = {
    source: 'sheet', sheet_version: SHEET_VERSION,
    kurma_id: q.kurma.id, kurma_name: q.kurma.name, weight: q.weight, finishing,
    quantity: q.qty, requested_qty: q.requestedQty,
    template_id: template?.id ?? null, template_name: template?.name ?? null,
    logo_url: logoUrl, mockup_url: mockupUrl, full_design_url: fullDesignUrl, logo_transform: logoTransform,
    source_utm: sourceUtm,
  }
  const row: Record<string, unknown> = {
    order_number: orderNumber,
    channel: 'online',
    name, phone, email, company,
    delivery_method: 'delivery',
    config,
    custom_design_url: mockupUrl ?? fullDesignUrl ?? logoUrl ?? null,
    quantity: q.qty,
    unit_price: q.perBox,
    subtotal: q.total,
    delivery_fee: 0,
    total: q.total,
    deposit_pct: DEFAULT_DEPOSIT_PCT,
    deposit_amount: deposit,
    balance,
    payment_status: 'unpaid',
    status: 'enquiry',
    notes,
    list_unit_price: q.perBox,   // migration 143 — snapshot harga senarai
  }
  const insert = () => sb.from('gift_orders').insert(row).select('id, order_number').single()
  let { data: order, error } = await insert()
  // Migration 143 belum dijalankan → kolum list_unit_price tiada. Ulang tanpanya (kelakuan lama).
  if (error && MISSING_COLUMN.has(error.code ?? '')) {
    delete row.list_unit_price
    ;({ data: order, error } = await insert())
  }
  if (error || !order) return NextResponse.json({ error: error?.message ?? 'Gagal cipta enquiry' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'
  const link = (u: string | null, label: string) => (u ? `<p>${label}: <a href="${esc(u)}">lihat</a></p>` : '')
  sendAdminEmail({
    subject: `Enquiry Studio — ${order.order_number} (${name})`,
    html: `<h2>Enquiry Gift Box Kurma (Studio)</h2>
      <p><b>${esc(order.order_number)}</b> · ${esc(name)} · ${esc(phone)}${email ? ` · ${esc(email)}` : ''}${company ? ` · ${esc(company)}` : ''}</p>
      <p>Kurma: <b>${esc(q.kurma.name)}</b> · Berat: <b>${q.weight}</b> · Kuantiti: <b>${q.qty}</b>${q.clamped ? ` (diminta ${q.requestedQty})` : ''}${finishing ? ` · Finishing: ${esc(finishing)}` : ''}</p>
      <p>Harga senarai: <b>RM${q.perBox.toFixed(2)}/kotak</b> × ${q.qty} = <b>RM${q.total.toFixed(2)}</b> (deposit ${DEFAULT_DEPOSIT_PCT}% = RM${deposit.toFixed(2)})</p>
      ${template ? `<p>Template: <b>${esc(template.name)}</b></p>` : ''}
      ${link(mockupUrl, 'Mockup (template + logo)')}${link(logoUrl, 'Logo')}${link(fullDesignUrl, 'Design penuh')}
      ${notes ? `<p>Nota: ${esc(notes)}</p>` : ''}${sourceUtm ? `<p>Sumber: ${esc(sourceUtm)}</p>` : ''}
      <p><a href="${appUrl}/admin/kurma/${order.id}">Buka di admin → sebut harga (senarai vs kos)</a></p>`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, order_number: order.order_number, total: q.total, per_box: q.perBox, qty: q.qty, deposit })
}
