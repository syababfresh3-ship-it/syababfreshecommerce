import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { isHoneypotFilled } from '@/lib/order-guard'
import { sendAdminEmail } from '@/lib/zeptomail'
import { depositFor, DEFAULT_DEPOSIT_PCT } from '@/lib/gift'
import { sheetQuote, SHEET_VERSION } from '@/lib/gift-pricing'

// POST /api/kurma/rfq — permintaan sebut harga rasmi dari LP korporat (/kurma/korporat):
// organisasi + pegawai + anggaran kuantiti (+ pilihan calculator jika ada) → SIMPAN ke gift_orders
// (status 'enquiry', config.source='rfq'), e-mel admin, pulang no. rujukan → klien terus WhatsApp.
//
// Berasingan dari /api/kurma/enquiry (Studio: template/logo/mockup, pilihan sheet WAJIB) & /api/kurma/order
// (katalog) — kedua-duanya tak disentuh. Pilihan sheet di sini PILIHAN: pegawai perolehan selalunya
// belum tahu gred kurma; bila ada, harga dikira semula di server (jangan percaya klien) supaya
// QuotePanel admin tunjuk harga senarai.
export const runtime = 'nodejs'

const MISSING_COLUMN = new Set(['42703', 'PGRST204'])
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))

function fakeGiftNumber() {
  const d = new Date(); const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `GIFT-${ymd}-${1000 + Math.floor(Math.random() * 9000)}`
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!(await rateLimitDb(`gift-rfq:${ip}`, 5, 60_000))) {
    return NextResponse.json({ error: 'Terlalu banyak percubaan, cuba sebentar lagi' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })

  // Honeypot diisi = bot → balas "berjaya" palsu, tiada DB.
  if (isHoneypotFilled(body)) {
    console.warn(`[order-guard] honeypot hit (gift-rfq) ip=${ip}`)
    return NextResponse.json({ ok: true, order_number: fakeGiftNumber(), est_qty: Number(body.est_qty) || 0, quote: null })
  }

  const organisation = str(body.organisation, 160)
  const name = str(body.name, 120)
  const role = str(body.role, 120) || null
  const phone = str(body.phone, 30)
  const emailRaw = str(body.email, 160)
  const notes = str(body.notes, 2000) || null
  const sourceUtm = str(body.source_utm, 120) || null
  const estQty = Number(body.est_qty)
  const neededByRaw = str(body.needed_by, 10)
  if (organisation.length < 2) return NextResponse.json({ error: 'Nama organisasi diperlukan' }, { status: 400 })
  if (name.length < 2) return NextResponse.json({ error: 'Nama pegawai diperlukan' }, { status: 400 })
  if (phone.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'No. telefon tidak sah' }, { status: 400 })
  if (emailRaw && !EMAIL_RE.test(emailRaw)) return NextResponse.json({ error: 'Email tidak sah' }, { status: 400 })
  if (!Number.isInteger(estQty) || estQty < 1 || estQty > 100_000) return NextResponse.json({ error: 'Anggaran kuantiti tidak sah' }, { status: 400 })
  if (neededByRaw && (!DATE_RE.test(neededByRaw) || Number.isNaN(Date.parse(neededByRaw)))) return NextResponse.json({ error: 'Tarikh tidak sah' }, { status: 400 })
  const email = emailRaw || null
  const neededBy = neededByRaw || null

  // Pilihan calculator (pilihan) — kira semula dari sheet; tak sah → abaikan, JANGAN gagalkan RFQ.
  const selIn = body.sel && typeof body.sel === 'object' ? body.sel as Record<string, unknown> : null
  const qTry = selIn ? sheetQuote({ kurmaId: selIn.kurmaId, weight: selIn.weight, qty: Math.min(100_000, Number(selIn.qty)) }) : null
  const q = qTry && qTry.ok ? qTry : null

  const sb = createAdminClient()

  // Dedup 2 minit: telefon + organisasi sama (klik berganda / refresh) → pulang rekod sedia ada
  const since = new Date(Date.now() - 2 * 60_000).toISOString()
  const { data: recent } = await sb.from('gift_orders').select('id, order_number, quantity, unit_price, total, config')
    .eq('phone', phone).gte('created_at', since).order('created_at', { ascending: false }).limit(5)
  const dup = (recent ?? []).find(r => {
    const c = (r.config ?? {}) as Record<string, unknown>
    return c.source === 'rfq' && String(c.organisation ?? '').toLowerCase() === organisation.toLowerCase()
  })
  if (dup) {
    const c = (dup.config ?? {}) as Record<string, unknown>
    const quote = c.kurma_id ? { per_box: Number(dup.unit_price), total: Number(dup.total), qty: Number(dup.quantity) } : null
    return NextResponse.json({ ok: true, duplicate: true, order_number: dup.order_number, est_qty: Number(c.est_qty ?? dup.quantity), quote })
  }

  const total = q ? q.total : 0
  const { deposit, balance } = q ? depositFor(total, DEFAULT_DEPOSIT_PCT) : { deposit: 0, balance: 0 }
  const { data: orderNumber } = await sb.rpc('generate_gift_order_number')
  const config = {
    source: 'rfq', angle: 'korporat',
    organisation, role, est_qty: estQty, needed_by: neededBy, source_utm: sourceUtm,
    ...(q ? { sheet_version: SHEET_VERSION, kurma_id: q.kurma.id, kurma_name: q.kurma.name, weight: q.weight, quantity: q.qty, requested_qty: q.requestedQty } : {}),
  }
  const row: Record<string, unknown> = {
    order_number: orderNumber,
    channel: 'online',
    name, phone, email, company: organisation,
    delivery_method: 'delivery',
    config,
    quantity: q ? q.qty : estQty,
    unit_price: q ? q.perBox : 0,
    subtotal: total,
    delivery_fee: 0,
    total,
    deposit_pct: DEFAULT_DEPOSIT_PCT,
    deposit_amount: deposit,
    balance,
    payment_status: 'unpaid',
    status: 'enquiry',
    notes,
    ...(q ? { list_unit_price: q.perBox } : {}),   // migration 143 — snapshot harga senarai
  }
  const insert = () => sb.from('gift_orders').insert(row).select('id, order_number').single()
  let { data: order, error } = await insert()
  // Migration 143 belum dijalankan → kolum list_unit_price tiada. Ulang tanpanya.
  if (error && 'list_unit_price' in row && MISSING_COLUMN.has(error.code ?? '')) {
    delete row.list_unit_price
    ;({ data: order, error } = await insert())
  }
  if (error || !order) return NextResponse.json({ error: error?.message ?? 'Gagal hantar permintaan' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'
  sendAdminEmail({
    subject: `RFQ Korporat — ${order.order_number} (${organisation})`,
    html: `<h2>Permintaan sebut harga rasmi (LP korporat)</h2>
      <p><b>${esc(order.order_number)}</b> · <b>${esc(organisation)}</b></p>
      <p>Pegawai: ${esc(name)}${role ? ` (${esc(role)})` : ''} · ${esc(phone)}${email ? ` · ${esc(email)}` : ''}</p>
      <p>Anggaran kuantiti: <b>${estQty}</b> kotak${neededBy ? ` · perlu menjelang <b>${esc(neededBy)}</b>` : ''}</p>
      ${q ? `<p>Pilihan calculator: <b>${esc(q.kurma.name)}</b> · ${q.weight} · ${q.qty} kotak → senarai RM${q.perBox.toFixed(2)}/kotak = RM${q.total.toFixed(2)}</p>` : '<p>Tiada pilihan kurma — cadangkan dalam sebut harga.</p>'}
      ${notes ? `<p>Nota: ${esc(notes)}</p>` : ''}${sourceUtm ? `<p>Sumber: ${esc(sourceUtm)}</p>` : ''}
      <p><a href="${appUrl}/admin/kurma/${order.id}">Buka di admin → sebut harga (senarai vs kos)</a></p>`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, order_number: order.order_number, est_qty: estQty, quote: q ? { per_box: q.perBox, total: q.total, qty: q.qty } : null })
}
