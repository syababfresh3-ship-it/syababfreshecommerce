// Pipeline Gift Kurma — jenis, peringkat, peraturan maju & amaran (pure; klien & server).
// Lihat docs/plan-pipeline-gift.md. Peringkat ialah medan bebas: auto hanya MAJU, admin boleh tukar.
import type { QuotationClient, QuotationInvoiceRef } from '@/lib/quotation'

export type DealStage = 'quote' | 'invoice' | 'deposit' | 'artwork' | 'production' | 'delivered' | 'balance' | 'done' | 'lost'
export const ACTIVE_STAGES: DealStage[] = ['quote', 'invoice', 'deposit', 'artwork', 'production', 'delivered', 'balance']
export const ALL_STAGES: DealStage[] = [...ACTIVE_STAGES, 'done', 'lost']
export const STAGE_LABEL: Record<DealStage, string> = {
  quote: 'Sebut harga', invoice: 'Invois', deposit: 'Deposit', artwork: 'Artwork OK', production: 'Produksi',
  delivered: 'Dihantar', balance: 'Baki dibayar', done: 'Selesai', lost: 'Batal / Kalah',
}
export const STAGE_HINT: Record<DealStage, string> = {
  quote: 'Dikeluarkan, tunggu klien minta invois', invoice: 'Invois dihantar, tunggu deposit', deposit: 'Deposit masuk, tunggu artwork disahkan',
  artwork: 'Mockup akhir disahkan klien', production: 'Cetak & isi sedang berjalan', delivered: 'Barang sampai, tunggu baki',
  balance: 'Baki lunas', done: 'Deal selesai', lost: 'Tidak jadi',
}
export const stageOrder = (s: string) => ACTIVE_STAGES.indexOf(s as DealStage)
export const stageLabel = (s: string) => STAGE_LABEL[s as DealStage] ?? s
export const DELIVERY_METHODS: [string, string][] = [['lalamove', 'Lalamove'], ['kurier', 'Kurier / Pos'], ['ambil', 'Ambil sendiri'], ['lain', 'Lain-lain']]
export const LOST_REASONS = ['Harga', 'Tempoh tak sempat', 'Pilih pesaing', 'Projek dibatalkan', 'Tiada respons', 'Lain-lain']
export const PAY_METHODS: [string, string][] = [['ACCOUNT_TRANSFER', 'Pindahan bank'], ['CASH', 'Tunai'], ['CHEQUE', 'Cek'], ['CREDIT_CARD', 'Kad kredit'], ['DEBIT_CARD', 'Kad debit'], ['CHIP', 'CHIP (pautan bayar)']]

export interface GiftDeal {
  id: string; quotation_id: string | null; gift_order_id?: string | null; customer_id: string | null; client: QuotationClient; title: string | null
  stage: DealStage; amount: number; accepted_at: string | null
  deposit_pct: number; deposit_paid_at: string | null; deposit_amount: number | null; deposit_source: string | null; deposit_ref: string | null
  balance_paid_at: string | null; balance_amount: number | null; balance_source: string | null; balance_ref: string | null
  po_number: string | null; po_file_url: string | null
  artwork_approved_at: string | null; artwork_by: string | null; artwork_file_url: string | null
  production_due: string | null; needed_by: string | null
  delivered_at: string | null; delivery_method: string | null; tracking_no: string | null; pod_url: string | null; received_by: string | null
  next_action: string | null; next_action_at: string | null; lost_reason: string | null; notes: string | null
  created_at: string; updated_at: string
}
export interface DealQuotationInfo { quote_number: string | null; status: string; valid_until: string | null; issued_at: string | null; share_token: string | null }
export interface DealRow extends GiftDeal { quotation: DealQuotationInfo | null; invoice: QuotationInvoiceRef | null; alerts: DealAlert[] }
export interface DealEvent { id: number; type: string; meta: Record<string, unknown>; actor: string | null; created_at: string }

export interface DealAlert { level: 'warn' | 'danger'; text: string }
const DAY = 86_400_000
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / DAY)
export const dateOnly = (d: string | null | undefined) => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : null

export const r2 = (n: number) => Math.round(n * 100) / 100
export const depositDue = (d: Pick<GiftDeal, 'amount' | 'deposit_pct'>) => r2(d.amount * (Number(d.deposit_pct) || 0) / 100)
export const balanceDue = (d: Pick<GiftDeal, 'amount' | 'deposit_pct' | 'deposit_amount' | 'deposit_paid_at'>) =>
  r2(d.amount - (d.deposit_paid_at ? (Number(d.deposit_amount) || depositDue(d)) : 0))

/** Peringkat sasaran hanya dipakai jika LEBIH maju daripada semasa (dan deal belum done/lost). */
export function advanceStage(current: DealStage, target: DealStage): DealStage {
  if (current === 'done' || current === 'lost') return current
  if (target === 'done') return 'done'
  return stageOrder(target) > stageOrder(current) ? target : current
}
/** Peringkat yang patut selepas peristiwa (auto maju sahaja). */
export function stageAfterInvoice(d: Pick<GiftDeal, 'stage' | 'deposit_pct'>): DealStage {
  return advanceStage(d.stage, Number(d.deposit_pct) === 0 ? 'artwork' : 'invoice')
}
export function stageAfterDeposit(d: Pick<GiftDeal, 'stage'>): DealStage { return advanceStage(d.stage, 'deposit') }
export function stageAfterDelivered(d: Pick<GiftDeal, 'stage' | 'balance_paid_at'>): DealStage {
  return advanceStage(d.stage, d.balance_paid_at ? 'done' : 'delivered')
}
export function stageAfterBalance(d: Pick<GiftDeal, 'stage' | 'delivered_at'>): DealStage {
  return advanceStage(d.stage, d.delivered_at ? 'done' : 'balance')
}

/** Amaran dikira masa papar (tiada kerja latar). */
export function dealAlerts(d: GiftDeal, q: DealQuotationInfo | null, inv: QuotationInvoiceRef | null, now = new Date()): DealAlert[] {
  const a: DealAlert[] = []
  if (d.stage === 'done' || d.stage === 'lost') return a
  const needed = dateOnly(d.needed_by)
  const daysToNeeded = needed ? daysBetween(needed, now) : null
  if (d.stage === 'quote') {
    if (q?.issued_at && !d.accepted_at && daysBetween(now, new Date(q.issued_at)) >= 3) a.push({ level: 'warn', text: 'Follow-up sebut harga' })
    const vu = dateOnly(q?.valid_until)
    if (vu && daysBetween(vu, now) <= 2) a.push({ level: vu < now ? 'danger' : 'warn', text: vu < now ? 'Sebut harga luput' : 'Hampir luput' })
  }
  if (d.stage === 'invoice' && inv?.created_at && !d.deposit_paid_at && Number(d.deposit_pct) > 0 && daysBetween(now, new Date(inv.created_at)) >= 5) a.push({ level: 'warn', text: 'Deposit belum masuk' })
  if (daysToNeeded !== null && stageOrder(d.stage) < stageOrder('delivered')) {
    if (!d.artwork_approved_at && daysToNeeded < 14) a.push({ level: daysToNeeded < 7 ? 'danger' : 'warn', text: 'Artwork belum OK' })
    if (daysToNeeded < 0 && !d.delivered_at) a.push({ level: 'danger', text: `Lewat hantar ${-daysToNeeded} hari` })
    else if (daysToNeeded <= 3 && !d.delivered_at) a.push({ level: 'warn', text: `Hantar dalam ${daysToNeeded} hari` })
  }
  const pd = dateOnly(d.production_due)
  if (pd && needed && pd > needed && !d.delivered_at) a.push({ level: 'warn', text: 'Sasaran siap lewat dari tarikh hantar' })
  if (d.delivered_at && !d.balance_paid_at) {
    const days = daysBetween(now, new Date(d.delivered_at))
    if (days >= 14) a.push({ level: 'danger', text: `Baki tertunggak ${days} hari` })
    else if (days >= 7) a.push({ level: 'warn', text: `Baki tertunggak ${days} hari` })
  }
  const na = dateOnly(d.next_action_at)
  if (na && na < now) a.push({ level: 'warn', text: 'Tindakan tertunggak' })
  return a
}

export function dealTitle(client: QuotationClient, firstItem: string | null | undefined, itemCount: number): string {
  const who = (client.company || client.name || 'Klien').trim()
  const what = firstItem ? `${firstItem}${itemCount > 1 ? ` +${itemCount - 1}` : ''}` : 'Gift box'
  return `${what} — ${who}`.slice(0, 160)
}
