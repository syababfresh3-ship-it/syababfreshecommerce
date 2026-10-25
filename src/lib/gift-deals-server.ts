// Pipeline Gift Kurma — helper server (jadual gift_deals/gift_deal_events, migration 147).
// Hook dari modul sebut harga adalah best-effort: jadual tiada / ralat → sebut harga tetap jalan.
import { invoiceRefFromEvents, type Quotation, type QuotationInvoiceRef } from '@/lib/quotation'
import {
  ALL_STAGES, type DealEvent, type DealQuotationInfo, type DealRow, type DealStage, type GiftDeal,
  advanceStage, balanceDue, dealAlerts, dealTitle, depositDue, r2, stageAfterBalance, stageAfterDelivered, stageAfterDeposit, stageAfterInvoice,
} from '@/lib/gift-deals'
import { isRefrensConfigured, listPayments, recordPayment, type PaymentMethod } from '@/lib/refrens'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SB = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const num = (v: unknown, d: number | null = 0) => { const n = Number(v); return Number.isFinite(n) && v !== null && v !== undefined && v !== '' ? n : d }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function rowToDeal(r: Row): GiftDeal {
  return {
    id: r.id, quotation_id: r.quotation_id ?? null, customer_id: r.customer_id ?? null, client: r.client ?? {}, title: r.title ?? null,
    stage: (ALL_STAGES.includes(r.stage) ? r.stage : 'quote') as DealStage, amount: num(r.amount) as number, accepted_at: r.accepted_at ?? null,
    deposit_pct: num(r.deposit_pct, 50) as number, deposit_paid_at: r.deposit_paid_at ?? null, deposit_amount: num(r.deposit_amount, null), deposit_source: r.deposit_source ?? null, deposit_ref: r.deposit_ref ?? null,
    balance_paid_at: r.balance_paid_at ?? null, balance_amount: num(r.balance_amount, null), balance_source: r.balance_source ?? null, balance_ref: r.balance_ref ?? null,
    po_number: r.po_number ?? null, po_file_url: r.po_file_url ?? null,
    artwork_approved_at: r.artwork_approved_at ?? null, artwork_by: r.artwork_by ?? null, artwork_file_url: r.artwork_file_url ?? null,
    production_due: r.production_due ?? null, needed_by: r.needed_by ?? null,
    delivered_at: r.delivered_at ?? null, delivery_method: r.delivery_method ?? null, tracking_no: r.tracking_no ?? null, pod_url: r.pod_url ?? null, received_by: r.received_by ?? null,
    next_action: r.next_action ?? null, next_action_at: r.next_action_at ?? null, lost_reason: r.lost_reason ?? null, notes: r.notes ?? null,
    created_at: r.created_at, updated_at: r.updated_at,
  }
}
export async function logDealEvent(sb: SB, dealId: string, type: string, meta: Record<string, unknown> = {}, actor: string | null = null) {
  try { await sb.from('gift_deal_events').insert({ deal_id: dealId, type, meta, actor }) } catch { /* best-effort */ }
}

// ── Lampirkan sebut harga + invois Refrens + amaran ────────────────────────
async function attach(sb: SB, deals: GiftDeal[]): Promise<DealRow[]> {
  const qids = deals.map(d => d.quotation_id).filter(Boolean) as string[]
  const quotes = new Map<string, DealQuotationInfo>()
  const invoices = new Map<string, QuotationInvoiceRef>()
  if (qids.length) {
    const { data: qs } = await sb.from('quotations').select('id, quote_number, status, valid_until, issued_at, share_token').in('id', qids)
    for (const q of qs ?? []) quotes.set(q.id, { quote_number: q.quote_number, status: q.status, valid_until: q.valid_until, issued_at: q.issued_at, share_token: q.share_token })
    const { data: evs } = await sb.from('quotation_events').select('quotation_id, type, meta, created_at').in('quotation_id', qids).in('type', ['converted', 'invoice_synced']).order('created_at', { ascending: false })
    const byQ = new Map<string, Row[]>()
    for (const ev of evs ?? []) { const arr = byQ.get(ev.quotation_id) ?? []; arr.push(ev); byQ.set(ev.quotation_id, arr) }
    for (const [qid, arr] of byQ) { const ref = invoiceRefFromEvents(arr as never); if (ref) invoices.set(qid, ref) }
  }
  const now = new Date()
  return deals.map(d => {
    const q = d.quotation_id ? quotes.get(d.quotation_id) ?? null : null
    const inv = d.quotation_id ? invoices.get(d.quotation_id) ?? null : null
    return { ...d, quotation: q, invoice: inv, alerts: dealAlerts(d, q, inv, now) }
  })
}

export async function listDeals(sb: SB, opts: { scope?: string; q?: string }): Promise<DealRow[]> {
  let query = sb.from('gift_deals').select('*').order('needed_by', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(500)
  const scope = opts.scope ?? 'active'
  if (scope === 'active') query = query.not('stage', 'in', '("done","lost")')
  else if (scope === 'done' || scope === 'lost') query = query.eq('stage', scope)
  const term = (opts.q ?? '').replace(/[,()*\\%]/g, ' ').trim()
  if (term.length >= 2) query = query.or(`title.ilike.%${term}%,client->>company.ilike.%${term}%,client->>name.ilike.%${term}%,po_number.ilike.%${term}%`)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return attach(sb, (data ?? []).map(rowToDeal))
}
export async function loadDeal(sb: SB, id: string): Promise<GiftDeal | null> {
  if (!UUID_RE.test(id)) return null
  const { data } = await sb.from('gift_deals').select('*').eq('id', id).maybeSingle()
  return data ? rowToDeal(data) : null
}
export async function loadDealRow(sb: SB, id: string): Promise<(DealRow & { events: DealEvent[] }) | null> {
  const d = await loadDeal(sb, id)
  if (!d) return null
  const [row] = await attach(sb, [d])
  const { data: evs } = await sb.from('gift_deal_events').select('id, type, meta, actor, created_at').eq('deal_id', id).order('created_at', { ascending: false }).limit(100)
  return { ...row, events: (evs ?? []) as DealEvent[] }
}

// ── Hook dari sebut harga (best-effort) ───────────────────────────────────
export async function ensureDealForQuotation(sb: SB, q: Quotation, actor: string | null): Promise<string | null> {
  try {
    const { data: existing } = await sb.from('gift_deals').select('id').eq('quotation_id', q.id).maybeSingle()
    if (existing?.id) return existing.id
    let depositPct = 50
    if (q.source_type === 'gift_order' && q.source_id) {
      const { data: o } = await sb.from('gift_orders').select('deposit_pct').eq('id', q.source_id).maybeSingle()
      if (o && Number.isFinite(Number(o.deposit_pct))) depositPct = Number(o.deposit_pct)
    }
    const row = {
      quotation_id: q.id, customer_id: q.customer_id, client: q.client, title: dealTitle(q.client, q.items[0]?.name, q.items.length),
      stage: 'quote', amount: r2(q.total), accepted_at: q.accepted_at, deposit_pct: depositPct, needed_by: q.needed_by ?? null,
    }
    const { data, error } = await sb.from('gift_deals').insert(row).select('id').single()
    if (error) { if (error.code !== '23505') console.warn('[gift-deals] cipta deal gagal', error.message); return null }
    await logDealEvent(sb, data.id, 'created', { quote_number: q.quote_number, amount: row.amount }, actor)
    return data.id as string
  } catch (e) { console.warn('[gift-deals] hook', (e as Error).message); return null }
}
async function dealByQuotation(sb: SB, quotationId: string): Promise<GiftDeal | null> {
  try { const { data } = await sb.from('gift_deals').select('*').eq('quotation_id', quotationId).maybeSingle(); return data ? rowToDeal(data) : null } catch { return null }
}
export async function markDealAccepted(sb: SB, quotationId: string, at: string, by: string | null) {
  const d = await dealByQuotation(sb, quotationId); if (!d) return
  try {
    await sb.from('gift_deals').update({ accepted_at: at, updated_at: new Date().toISOString() }).eq('id', d.id)
    await logDealEvent(sb, d.id, 'accepted', { by }, 'client')
  } catch { /* best-effort */ }
}
export async function markDealInvoice(sb: SB, quotationId: string, invoiceNumber: string, actor: string | null) {
  const d = await dealByQuotation(sb, quotationId); if (!d) return
  const stage = stageAfterInvoice(d)
  try {
    await sb.from('gift_deals').update({ stage, updated_at: new Date().toISOString() }).eq('id', d.id)
    await logDealEvent(sb, d.id, 'stage', { to: stage, invoice: invoiceNumber }, actor)
  } catch { /* best-effort */ }
}
export async function markDealLost(sb: SB, quotationId: string, reason: string, actor: string | null) {
  const d = await dealByQuotation(sb, quotationId); if (!d || d.stage === 'done') return
  try {
    await sb.from('gift_deals').update({ stage: 'lost', lost_reason: d.lost_reason ?? reason, updated_at: new Date().toISOString() }).eq('id', d.id)
    await logDealEvent(sb, d.id, 'stage', { to: 'lost', reason }, actor)
  } catch { /* best-effort */ }
}

// ── PATCH medan manual ─────────────────────────────────────────────────────
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null
const dateOrNull = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v)) ? v : null
const tsOrNull = (v: unknown) => { if (typeof v !== 'string' || !v) return null; const d = new Date(v.length === 10 ? v + 'T12:00:00' : v); return isNaN(d.getTime()) ? null : d.toISOString() }
export function parseDealPatch(body: Row): { ok: true; patch: Row; stageTouched: boolean } | { ok: false; error: string } {
  const p: Row = {}
  const has = (k: string) => body[k] !== undefined
  if (has('stage')) { if (!ALL_STAGES.includes(body.stage)) return { ok: false, error: 'Peringkat tidak sah' }; p.stage = body.stage }
  if (has('title')) p.title = str(body.title, 160)
  if (has('deposit_pct')) { const n = Math.round(Number(body.deposit_pct)); if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: 'Peratus deposit 0–100' }; p.deposit_pct = n }
  for (const k of ['po_number', 'artwork_by', 'tracking_no', 'received_by', 'next_action', 'lost_reason', 'delivery_method']) if (has(k)) p[k] = str(body[k], 200)
  for (const k of ['po_file_url', 'artwork_file_url', 'pod_url']) if (has(k)) p[k] = str(body[k], 1000)
  if (has('notes')) p.notes = str(body.notes, 4000)
  for (const k of ['production_due', 'needed_by', 'next_action_at']) if (has(k)) p[k] = dateOrNull(body[k])
  for (const k of ['artwork_approved_at', 'delivered_at']) if (has(k)) p[k] = tsOrNull(body[k])
  if (p.stage === 'lost' && !p.lost_reason && !body.lost_reason) { /* sebab digalakkan, tidak dipaksa */ }
  return { ok: true, patch: p, stageTouched: has('stage') }
}
export async function patchDeal(sb: SB, d: GiftDeal, patch: Row, stageTouched: boolean, actor: string | null): Promise<GiftDeal> {
  const upd: Row = { ...patch, updated_at: new Date().toISOString() }
  // Auto maju (hanya bila admin tak tetapkan peringkat sendiri)
  if (!stageTouched) {
    let stage = d.stage
    if (patch.artwork_approved_at && !d.artwork_approved_at) stage = advanceStage(stage, 'artwork')
    if (patch.delivered_at && !d.delivered_at) stage = stageAfterDelivered({ stage, balance_paid_at: d.balance_paid_at })
    if (stage !== d.stage) upd.stage = stage
  }
  const { data, error } = await sb.from('gift_deals').update(upd).eq('id', d.id).select('*').single()
  if (error) throw new Error(error.message)
  const nd = rowToDeal(data)
  if (nd.stage !== d.stage) await logDealEvent(sb, d.id, 'stage', { from: d.stage, to: nd.stage, reason: patch.lost_reason ?? undefined }, actor)
  if (patch.delivered_at && !d.delivered_at) await logDealEvent(sb, d.id, 'delivered', { at: patch.delivered_at, method: nd.delivery_method, tracking: nd.tracking_no }, actor)
  if (patch.artwork_approved_at && !d.artwork_approved_at) await logDealEvent(sb, d.id, 'artwork', { at: patch.artwork_approved_at, by: nd.artwork_by }, actor)
  const other = Object.keys(patch).filter(k => !['delivered_at', 'artwork_approved_at', 'stage'].includes(k))
  if (other.length) await logDealEvent(sb, d.id, 'edited', { fields: other }, actor)
  // Tarikh perlu hantar disegerakkan balik ke sebut harga (best-effort)
  if (patch.needed_by !== undefined && d.quotation_id) { try { await sb.from('quotations').update({ needed_by: patch.needed_by }).eq('id', d.quotation_id) } catch { /* abaikan */ } }
  return nd
}

// ── Bayaran: manual (± rekod juga di Refrens) ──────────────────────────────
export async function recordDealPayment(sb: SB, d: GiftDeal, inv: QuotationInvoiceRef | null, p: { kind: 'deposit' | 'balance'; amount: number; date: string; method: string; ref?: string | null; also_refrens?: boolean }, actor: string | null) {
  const at = new Date(p.date + 'T12:00:00').toISOString()
  let refrensResult: 'recorded' | 'skipped' | 'failed' = 'skipped'
  if (p.also_refrens && inv?.id && isRefrensConfigured()) {
    try {
      const method = (p.method === 'CHIP' ? 'ACCOUNT_TRANSFER' : p.method) as PaymentMethod
      await recordPayment(inv.id, { amount: p.amount, paymentDate: at, paymentMethod: method, refId: p.ref ?? null, notes: `${p.kind === 'deposit' ? 'Deposit' : 'Baki'} — direkod dari Pipeline Gift (${actor ?? '-'})` }, `deal-${d.id}-${p.kind}-${p.date}-${p.amount.toFixed(2)}`)
      refrensResult = 'recorded'
    } catch (e) { refrensResult = 'failed'; console.warn('[gift-deals] rekod bayaran Refrens gagal', (e as Error).message) }
  }
  const source = refrensResult === 'recorded' ? 'manual+refrens' : 'manual'
  const upd: Row = p.kind === 'deposit'
    ? { deposit_paid_at: at, deposit_amount: r2(p.amount), deposit_source: source, deposit_ref: p.ref ?? null, stage: stageAfterDeposit(d) }
    : { balance_paid_at: at, balance_amount: r2(p.amount), balance_source: source, balance_ref: p.ref ?? null, stage: stageAfterBalance(d) }
  upd.updated_at = new Date().toISOString()
  const { data, error } = await sb.from('gift_deals').update(upd).eq('id', d.id).select('*').single()
  if (error) throw new Error(error.message)
  await logDealEvent(sb, d.id, 'payment', { kind: p.kind, amount: r2(p.amount), method: p.method, ref: p.ref ?? null, refrens: refrensResult }, actor)
  return { deal: rowToDeal(data), refrens: refrensResult }
}

// ── Segerak bayaran dari Refrens (invois berpaut) ──────────────────────────
export async function syncDealFromRefrens(sb: SB, d: GiftDeal, inv: QuotationInvoiceRef | null, actor: string | null) {
  if (!inv?.id) return { deal: d, changed: false, paid: 0, note: 'Tiada invois Refrens berpaut' }
  if (!isRefrensConfigured()) return { deal: d, changed: false, paid: 0, note: 'Refrens belum dikonfigurasi' }
  const payments = (await listPayments(inv.id)).filter(p => !p.isRemoved)
  const paid = r2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0))
  const first = payments.map(p => p.paymentDate ?? p.createdAt).filter(Boolean).sort()[0] ?? new Date().toISOString()
  const last = payments.map(p => p.paymentDate ?? p.createdAt).filter(Boolean).sort().slice(-1)[0] ?? new Date().toISOString()
  const upd: Row = {}
  let stage = d.stage
  const dep = depositDue(d)
  if (!d.deposit_paid_at && dep > 0 && paid >= dep - 0.01) { upd.deposit_paid_at = first; upd.deposit_amount = dep; upd.deposit_source = 'refrens'; stage = stageAfterDeposit({ stage }) }
  const depositPaidAmt = (d.deposit_paid_at || upd.deposit_paid_at) ? (Number(d.deposit_amount) || dep) : 0
  if (!d.balance_paid_at && paid >= d.amount - 0.01 && d.amount > 0) { upd.balance_paid_at = last; upd.balance_amount = r2(paid - depositPaidAmt); upd.balance_source = 'refrens'; stage = stageAfterBalance({ stage, delivered_at: d.delivered_at }) }
  if (stage !== d.stage) upd.stage = stage
  if (!Object.keys(upd).length) { await logDealEvent(sb, d.id, 'synced', { paid, changed: false }, actor); return { deal: d, changed: false, paid, note: `Dibayar di Refrens ${paid.toFixed(2)}; baki perlu ${balanceDue(d).toFixed(2)}` } }
  upd.updated_at = new Date().toISOString()
  const { data, error } = await sb.from('gift_deals').update(upd).eq('id', d.id).select('*').single()
  if (error) throw new Error(error.message)
  await logDealEvent(sb, d.id, 'synced', { paid, changed: true, fields: Object.keys(upd) }, actor)
  return { deal: rowToDeal(data), changed: true, paid, note: null }
}
