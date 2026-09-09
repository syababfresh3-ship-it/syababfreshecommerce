// ============================================================
// daily-summary — laporan ringkas SEMALAM (waktu Malaysia) untuk admin.
//
// buildDailySummary(): fungsi tulen — Supabase admin client masuk, JSON keluar,
// tiada side-effect → boleh diuji tanpa hantar apa-apa. Penghantaran
// (WA admin / push admin / email) diasingkan dalam sendDailySummary().
// Dipanggil oleh /api/cron/daily-summary (cron-job.org 08:30 harian).
//
// Definisi:
//   • "Semalam" = hari kalendar sebelum ini di Asia/Kuala_Lumpur (UTC+8, tiada DST).
//   • Hasil = jumlah `total` order dengan payment_status='paid' (storefront & LP),
//     tak termasuk status cancelled/refunded. COD belum bayar dilapor berasingan.
//   • Cron senyap = peraturan sama dengan dashboard admin (tiada stamp, atau
//     stamp > 3× expected_minutes).
//   • error_reports (migration 124) mungkin belum wujud → dilapor "tidak tersedia".
// ============================================================

import type { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'
import { sendAdminPush } from '@/lib/push'
import { sendAdminEmail } from '@/lib/zeptomail'

type SB = ReturnType<typeof createAdminClient>

export const KL_TZ = 'Asia/Kuala_Lumpur'
const KL_OFFSET = '+08:00' // Malaysia tiada DST — offset tetap selamat

export const WA_MAX_CHARS = 1500
const LOW_STOCK_THRESHOLD = 5
const EXPIRY_DAYS = 3
const MAX_LINES = 10

// ─── Tarikh (KL) ─────────────────────────────────────────────────────────────

/** YYYY-MM-DD bagi `d` mengikut waktu Malaysia. */
export function klDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** Anjak YYYY-MM-DD sebanyak `days` (boleh negatif). */
export function shiftDateStr(ymd: string, days: number): string {
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) + days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** Tetingkap ISO [start, end) untuk satu hari kalendar KL. */
export function klDayWindow(ymd: string): { start: string; end: string } {
  return {
    start: new Date(`${ymd}T00:00:00${KL_OFFSET}`).toISOString(),
    end: new Date(`${shiftDateStr(ymd, 1)}T00:00:00${KL_OFFSET}`).toISOString(),
  }
}

export function isValidYmd(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())
}

function dateLabel(ymd: string): string {
  // "Isnin, 08/09/2026"
  return new Intl.DateTimeFormat('ms-MY', {
    timeZone: KL_TZ, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${ymd}T12:00:00${KL_OFFSET}`))
}

// ─── Jenis laporan ───────────────────────────────────────────────────────────

export interface ChannelStats {
  orders: number          // order dicipta semalam, tak termasuk cancelled/refunded
  paidOrders: number
  revenue: number         // jumlah total order paid
  codUnpaid: number       // COD belum bayar (semalam)
  codUnpaidAmount: number
  unpaidOther: number     // bukan COD & belum bayar (cth FPX ditinggal)
  cancelled: number
}

export interface ProductLine { name: string; revenue: number; qty: number }
export interface StockLine { name: string; stock: number }
export interface ExpiryLine { name: string; quantity: number; expiryDate: string }

export interface DailySummaryReport {
  date: string            // YYYY-MM-DD (KL)
  dateLabel: string
  window: { start: string; end: string }
  generatedAt: string
  revenue: number
  orders: number
  paidOrders: number
  aov: number
  storefront: ChannelStats
  lp: ChannelStats
  topProducts: ProductLine[]
  codOutstanding: { count: number; amount: number }   // semua masa
  pendingOrders: { storefront: number; lp: number; total: number }
  lowStock: { count: number; lines: StockLine[] }
  expiring: { count: number; lines: ExpiryLine[] }
  refunds: { open: number; pastDeadline: number }
  staleCrons: string[]
  errors: { available: boolean; count: number; top: { message: string; count: number }[] }
  warnings: string[]      // ralat query bukan-fatal (laporan tetap dibina)
}

// ─── Helper ──────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string
  total: number | string
  status: string
  payment_status: string | null
  payment_method: string | null
  order_items?: ItemRow[] | null
  items?: ItemRow[] | null
  product_name?: string | null
  quantity?: number | null
  unit_price?: number | string | null
}
type ItemRow = { product_name?: string | null; name?: string | null; quantity?: number | null; unit_price?: number | string | null }

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const isDead = (status: string | null | undefined) => status === 'cancelled' || status === 'refunded'

function emptyStats(): ChannelStats {
  return { orders: 0, paidOrders: 0, revenue: 0, codUnpaid: 0, codUnpaidAmount: 0, unpaidOther: 0, cancelled: 0 }
}

function tally(rows: OrderRow[], products: Map<string, ProductLine>): ChannelStats {
  const s = emptyStats()
  for (const o of rows) {
    if (isDead(o.status)) { s.cancelled++; continue }
    s.orders++
    const total = num(o.total)
    if (o.payment_status === 'paid') {
      s.paidOrders++
      s.revenue += total
      for (const it of orderItems(o)) {
        const name = (it.product_name ?? it.name ?? '').trim() || '(tanpa nama)'
        const qty = num(it.quantity)
        const rev = num(it.unit_price) * qty
        const cur = products.get(name) ?? { name, revenue: 0, qty: 0 }
        cur.revenue += rev
        cur.qty += qty
        products.set(name, cur)
      }
    } else if (o.payment_method === 'cod') {
      s.codUnpaid++
      s.codUnpaidAmount += total
    } else {
      s.unpaidOther++
    }
  }
  return s
}

function orderItems(o: OrderRow): ItemRow[] {
  if (Array.isArray(o.order_items)) return o.order_items
  if (Array.isArray(o.items) && o.items.length) return o.items
  // LP lama (sebelum 043): satu produk per order dalam lajur terus
  if (o.product_name) return [{ product_name: o.product_name, quantity: o.quantity ?? 1, unit_price: o.unit_price ?? 0 }]
  return []
}

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === '42P01' || err.code === 'PGRST205') return true
  return /does not exist|could not find the table/i.test(err.message ?? '')
}

// ─── Pembina laporan ─────────────────────────────────────────────────────────

export async function buildDailySummary(
  admin: SB,
  opts: { date?: string; now?: Date } = {},
): Promise<DailySummaryReport> {
  const now = opts.now ?? new Date()
  const today = klDateStr(now)
  const date = opts.date && isValidYmd(opts.date) ? opts.date : shiftDateStr(today, -1)
  const window = klDayWindow(date)
  const warnings: string[] = []
  const warn = (label: string, err: { message?: string } | null) => {
    if (err) warnings.push(`${label}: ${err.message ?? 'ralat'}`)
  }

  const [
    sfOrders, lpOrders,
    sfCod, lpCod,
    sfPending, lpPending,
    products, stock, variants,
    batches,
    refunds,
    heartbeats,
    errors,
  ] = await Promise.all([
    admin.from('orders')
      .select('id, total, status, payment_status, payment_method, order_items(product_name, quantity, unit_price, product_id)')
      .gte('created_at', window.start).lt('created_at', window.end).limit(2000),
    admin.from('lp_guest_orders')
      .select('id, total, status, payment_status, payment_method, items, product_name, quantity, unit_price')
      .gte('created_at', window.start).lt('created_at', window.end).limit(2000),

    // COD tertunggak (semua masa): COD, belum 'paid', bukan cancelled/refunded.
    // NOTA: COD tidak auto-ditanda paid selepas hantar → ini termasuk yang dah
    // delivered tapi bayaran belum direkod (memang itu yang nak dijejak).
    admin.from('orders').select('total').eq('payment_method', 'cod').neq('payment_status', 'paid')
      .not('status', 'in', '(cancelled,refunded)').limit(5000),
    admin.from('lp_guest_orders').select('total').eq('payment_method', 'cod').neq('payment_status', 'paid')
      .not('status', 'in', '(cancelled,refunded)').limit(5000),

    // Pending yang perlu tindakan: dah bayar, atau COD/bank transfer (FPX belum
    // bayar = mungkin ditinggal, tak dikira — sama semantik dengan lp-loyalty).
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .or('payment_status.eq.paid,payment_method.in.(cod,bank_transfer)'),
    admin.from('lp_guest_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .or('payment_status.eq.paid,payment_method.in.(cod,bank_transfer)'),

    admin.from('products').select('id, name').eq('is_active', true),
    admin.from('product_stock').select('product_id, available_stock'),
    admin.from('product_variants').select('product_id, stock').eq('is_active', true),

    admin.from('inventory_batches')
      .select('quantity, expiry_date, products(name)', { count: 'exact' })
      .gt('quantity', 0).gte('expiry_date', today).lte('expiry_date', shiftDateStr(today, EXPIRY_DAYS))
      .order('expiry_date', { ascending: true }).limit(MAX_LINES),

    admin.from('refunds').select('id, deadline').in('status', ['pending', 'processing']),

    admin.from('cron_heartbeats').select('job, last_ok_at, expected_minutes'),

    admin.from('error_reports').select('message')
      .gte('created_at', window.start).lt('created_at', window.end).limit(500),
  ])

  warn('orders', sfOrders.error); warn('lp_guest_orders', lpOrders.error)
  warn('orders(cod)', sfCod.error); warn('lp_guest_orders(cod)', lpCod.error)
  warn('orders(pending)', sfPending.error); warn('lp_guest_orders(pending)', lpPending.error)
  warn('products', products.error); warn('product_stock', stock.error); warn('product_variants', variants.error)
  warn('inventory_batches', batches.error); warn('refunds', refunds.error); warn('cron_heartbeats', heartbeats.error)

  // ── Jualan semalam ──
  const productMap = new Map<string, ProductLine>()
  const storefront = tally((sfOrders.data ?? []) as OrderRow[], productMap)
  const lp = tally((lpOrders.data ?? []) as OrderRow[], productMap)
  const revenue = storefront.revenue + lp.revenue
  const paidOrders = storefront.paidOrders + lp.paidOrders
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // ── COD tertunggak (semua masa) ──
  const codRows = [...(sfCod.data ?? []), ...(lpCod.data ?? [])] as { total: number | string }[]
  const codOutstanding = { count: codRows.length, amount: codRows.reduce((s, r) => s + num(r.total), 0) }

  // ── Stok rendah: (batch belum luput) + (variant aktif) ≤ ambang ──
  const batchStock = new Map<string, number>()
  for (const r of (stock.data ?? []) as { product_id: string; available_stock: number }[]) {
    batchStock.set(r.product_id, num(r.available_stock))
  }
  const variantStock = new Map<string, number>()
  for (const r of (variants.data ?? []) as { product_id: string; stock: number }[]) {
    variantStock.set(r.product_id, (variantStock.get(r.product_id) ?? 0) + num(r.stock))
  }
  const lowAll = ((products.data ?? []) as { id: string; name: string }[])
    .map(p => ({ name: p.name, stock: (batchStock.get(p.id) ?? 0) + (variantStock.get(p.id) ?? 0) }))
    .filter(p => p.stock <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
  const lowStock = { count: lowAll.length, lines: lowAll.slice(0, MAX_LINES) }

  // ── Batch luput ≤ 3 hari ──
  const expiring = {
    count: batches.count ?? (batches.data?.length ?? 0),
    lines: ((batches.data ?? []) as { quantity: number; expiry_date: string; products: { name: string } | { name: string }[] | null }[])
      .map(b => {
        const p = Array.isArray(b.products) ? b.products[0] : b.products
        return { name: p?.name ?? '(produk)', quantity: num(b.quantity), expiryDate: b.expiry_date }
      }),
  }

  // ── Refund belum selesai (pending + processing — sama dengan badge sidebar) ──
  const refundRows = (refunds.data ?? []) as { id: string; deadline: string | null }[]
  const refundsOut = {
    open: refundRows.length,
    pastDeadline: refundRows.filter(r => r.deadline && new Date(r.deadline).getTime() < now.getTime()).length,
  }

  // ── Cron senyap (peraturan sama dengan dashboard admin) ──
  const staleCrons = ((heartbeats.data ?? []) as { job: string; last_ok_at: string | null; expected_minutes: number }[])
    .filter(h => h.job !== 'daily-summary') // diri sendiri — tengah jalan
    .filter(h => !h.last_ok_at || now.getTime() - new Date(h.last_ok_at).getTime() > h.expected_minutes * 3 * 60_000)
    .map(h => h.job)
    .sort()

  // ── Ralat semalam (jadual mungkin belum wujud) ──
  let errorsOut: DailySummaryReport['errors'] = { available: false, count: 0, top: [] }
  if (errors.error) {
    if (!isMissingTable(errors.error)) warn('error_reports', errors.error)
  } else {
    const counts = new Map<string, number>()
    for (const r of (errors.data ?? []) as { message: string | null }[]) {
      const key = (r.message ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || '(tanpa mesej)'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    errorsOut = {
      available: true,
      count: errors.data?.length ?? 0,
      top: [...counts.entries()].map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count).slice(0, 3),
    }
  }

  return {
    date,
    dateLabel: dateLabel(date),
    window,
    generatedAt: now.toISOString(),
    revenue: round2(revenue),
    orders: storefront.orders + lp.orders,
    paidOrders,
    aov: paidOrders ? round2(revenue / paidOrders) : 0,
    storefront: roundStats(storefront),
    lp: roundStats(lp),
    topProducts: topProducts.map(p => ({ ...p, revenue: round2(p.revenue) })),
    codOutstanding: { ...codOutstanding, amount: round2(codOutstanding.amount) },
    pendingOrders: {
      storefront: sfPending.count ?? 0,
      lp: lpPending.count ?? 0,
      total: (sfPending.count ?? 0) + (lpPending.count ?? 0),
    },
    lowStock,
    expiring,
    refunds: refundsOut,
    staleCrons,
    errors: errorsOut,
    warnings,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
function roundStats(s: ChannelStats): ChannelStats {
  return { ...s, revenue: round2(s.revenue), codUnpaidAmount: round2(s.codUnpaidAmount) }
}

// ─── Format ──────────────────────────────────────────────────────────────────

export const rm = (n: number) =>
  'RM' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`

/** Teks WhatsApp (plain, tanpa emoji). Dihadkan ke WA_MAX_CHARS — senarai
 *  dipendekkan dulu sebelum dipotong keras. */
export function formatSummaryText(r: DailySummaryReport, maxChars = WA_MAX_CHARS): string {
  for (const lines of [MAX_LINES, 5, 3, 0]) {
    const text = renderText(r, lines)
    if (text.length <= maxChars) return text
  }
  return renderText(r, 0).slice(0, maxChars - 1) + '…'
}

function renderText(r: DailySummaryReport, listLines: number): string {
  const L: string[] = []
  L.push(`RINGKASAN HARIAN — ${r.dateLabel}`)
  L.push('')
  L.push('JUALAN SEMALAM')
  L.push(`Hasil (dibayar): ${rm(r.revenue)} · ${r.paidOrders} order · AOV ${rm(r.aov)}`)
  L.push(`- Storefront: ${rm(r.storefront.revenue)} (${r.storefront.paidOrders})`)
  L.push(`- LP: ${rm(r.lp.revenue)} (${r.lp.paidOrders})`)
  const codY = r.storefront.codUnpaid + r.lp.codUnpaid
  const codYAmt = r.storefront.codUnpaidAmount + r.lp.codUnpaidAmount
  L.push(`COD belum bayar: ${codY} order · ${rm(codYAmt)}`)
  const other = r.storefront.unpaidOther + r.lp.unpaidOther
  const cancelled = r.storefront.cancelled + r.lp.cancelled
  if (other || cancelled) L.push(`Belum bayar (bukan COD): ${other} · Dibatalkan: ${cancelled}`)

  if (r.topProducts.length && listLines > 0) {
    L.push('')
    L.push('TOP PRODUK')
    r.topProducts.slice(0, Math.max(listLines, 5)).forEach((p, i) =>
      L.push(`${i + 1}. ${p.name} — ${rm(p.revenue)} (${p.qty})`))
  }

  L.push('')
  L.push('OPERASI')
  L.push(`Order pending: ${r.pendingOrders.total} (SF ${r.pendingOrders.storefront} · LP ${r.pendingOrders.lp})`)
  L.push(`COD tertunggak (semua): ${r.codOutstanding.count} order · ${rm(r.codOutstanding.amount)}`)
  L.push(`Refund belum selesai: ${r.refunds.open}` + (r.refunds.pastDeadline ? ` (lewat deadline: ${r.refunds.pastDeadline})` : ''))
  L.push(`Cron senyap: ${r.staleCrons.length ? r.staleCrons.join(', ') : 'tiada'}`)

  L.push('')
  L.push(`STOK RENDAH (<=${LOW_STOCK_THRESHOLD}): ${r.lowStock.count}`)
  r.lowStock.lines.slice(0, listLines).forEach(p => L.push(`- ${p.name}: ${p.stock}`))
  if (r.lowStock.count > Math.min(listLines, r.lowStock.lines.length)) L.push(`- …dan ${r.lowStock.count - Math.min(listLines, r.lowStock.lines.length)} lagi`)

  L.push('')
  L.push(`LUPUT <=${EXPIRY_DAYS} HARI: ${r.expiring.count} batch`)
  r.expiring.lines.slice(0, listLines).forEach(b => L.push(`- ${b.name}: ${b.quantity} unit (${ddmm(b.expiryDate)})`))
  if (r.expiring.count > Math.min(listLines, r.expiring.lines.length)) L.push(`- …dan ${r.expiring.count - Math.min(listLines, r.expiring.lines.length)} lagi`)

  L.push('')
  if (!r.errors.available) {
    L.push('RALAT SEMALAM: tidak tersedia (jadual error_reports belum ada)')
  } else {
    L.push(`RALAT SEMALAM: ${r.errors.count}`)
    r.errors.top.slice(0, Math.min(3, listLines || 3)).forEach(e => L.push(`- (${e.count}x) ${e.message}`))
  }

  if (r.warnings.length) {
    L.push('')
    L.push(`Amaran laporan: ${r.warnings.length} query gagal`)
  }
  return L.join('\n')
}

export function formatSummaryPush(r: DailySummaryReport): { title: string; body: string } {
  const bits = [`${rm(r.revenue)}`, `${r.paidOrders} order`, `${r.pendingOrders.total} pending`]
  if (r.lowStock.count) bits.push(`${r.lowStock.count} stok rendah`)
  if (r.staleCrons.length) bits.push(`${r.staleCrons.length} cron senyap`)
  return { title: `Ringkasan semalam (${ddmm(r.date)})`, body: bits.join(' · ') }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Badan email (dibungkus layout oleh sendAdminEmail). */
export function formatSummaryHtml(r: DailySummaryReport): string {
  const h = (t: string) => `<h3 style="margin:20px 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">${escHtml(t)}</h3>`
  const row = (k: string, v: string) =>
    `<tr><td style="padding:5px 0;font-size:14px;color:#374151;">${escHtml(k)}</td><td style="padding:5px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;white-space:nowrap;">${escHtml(v)}</td></tr>`
  const table = (rows: string) => `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`
  const list = (items: string[], empty: string) =>
    items.length
      ? `<ul style="margin:0;padding-left:18px;font-size:14px;color:#374151;line-height:1.6;">${items.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>`
      : `<p style="margin:0;font-size:14px;color:#9ca3af;">${escHtml(empty)}</p>`

  const codY = r.storefront.codUnpaid + r.lp.codUnpaid
  const codYAmt = r.storefront.codUnpaidAmount + r.lp.codUnpaidAmount

  return `
    <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">Ringkasan harian</h2>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">${escHtml(r.dateLabel)}</p>

    ${h('Jualan semalam')}
    ${table(
      row('Hasil (dibayar)', rm(r.revenue)) +
      row('Order dibayar', String(r.paidOrders)) +
      row('AOV', rm(r.aov)) +
      row('Storefront', `${rm(r.storefront.revenue)} (${r.storefront.paidOrders})`) +
      row('Landing page', `${rm(r.lp.revenue)} (${r.lp.paidOrders})`) +
      row('COD belum bayar', `${codY} order · ${rm(codYAmt)}`) +
      row('Belum bayar (bukan COD)', String(r.storefront.unpaidOther + r.lp.unpaidOther)) +
      row('Dibatalkan', String(r.storefront.cancelled + r.lp.cancelled)),
    )}

    ${h('Top produk')}
    ${list(r.topProducts.map((p, i) => `${i + 1}. ${p.name} — ${rm(p.revenue)} (${p.qty} unit)`), 'Tiada jualan dibayar semalam.')}

    ${h('Operasi')}
    ${table(
      row('Order pending', `${r.pendingOrders.total} (SF ${r.pendingOrders.storefront} · LP ${r.pendingOrders.lp})`) +
      row('COD tertunggak (semua masa)', `${r.codOutstanding.count} order · ${rm(r.codOutstanding.amount)}`) +
      row('Refund belum selesai', `${r.refunds.open}${r.refunds.pastDeadline ? ` (lewat deadline: ${r.refunds.pastDeadline})` : ''}`) +
      row('Cron senyap', r.staleCrons.length ? r.staleCrons.join(', ') : 'tiada'),
    )}

    ${h(`Stok rendah (≤${LOW_STOCK_THRESHOLD}) — ${r.lowStock.count}`)}
    ${list(r.lowStock.lines.map(p => `${p.name}: ${p.stock}`), 'Tiada.')}

    ${h(`Batch luput ≤${EXPIRY_DAYS} hari — ${r.expiring.count}`)}
    ${list(r.expiring.lines.map(b => `${b.name}: ${b.quantity} unit (${b.expiryDate})`), 'Tiada.')}

    ${h(`Ralat semalam — ${r.errors.available ? r.errors.count : 'tidak tersedia'}`)}
    ${r.errors.available
      ? list(r.errors.top.map(e => `(${e.count}x) ${e.message}`), 'Tiada ralat dilaporkan.')
      : `<p style="margin:0;font-size:14px;color:#9ca3af;">Jadual error_reports belum wujud (migration 124).</p>`}

    ${r.warnings.length ? h('Amaran laporan') + list(r.warnings, '') : ''}
  `
}

// ─── Penghantaran ────────────────────────────────────────────────────────────

export type SendStatus = 'sent' | 'skipped' | 'failed'

export async function sendDailySummary(
  r: DailySummaryReport,
): Promise<{ whatsapp: SendStatus; push: SendStatus; email: SendStatus }> {
  const text = formatSummaryText(r)
  const out = { whatsapp: 'skipped' as SendStatus, push: 'skipped' as SendStatus, email: 'skipped' as SendStatus }

  const adminPhone = process.env.ADMIN_WHATSAPP
  if (adminPhone) {
    try {
      const res = await sendWhatsApp(adminPhone, text)
      out.whatsapp = 'skipped' in res ? 'skipped' : res.success ? 'sent' : 'failed'
    } catch (e) {
      console.error('[daily-summary] WA gagal:', e)
      out.whatsapp = 'failed'
    }
  }

  try {
    await sendAdminPush({ ...formatSummaryPush(r), url: '/admin', tag: 'daily-summary' })
    out.push = 'sent'
  } catch (e) {
    console.error('[daily-summary] push gagal:', e)
    out.push = 'failed'
  }

  if (process.env.ADMIN_EMAIL?.trim()) {
    try {
      const ok = await sendAdminEmail({ subject: `Ringkasan harian — ${r.dateLabel}`, html: formatSummaryHtml(r) })
      out.email = ok ? 'sent' : 'failed'
    } catch (e) {
      console.error('[daily-summary] email gagal:', e)
      out.email = 'failed'
    }
  }

  return out
}
