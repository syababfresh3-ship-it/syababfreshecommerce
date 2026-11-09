// Penyata konsainan — /pos/consign/<id penyata>. Perlu login POS (gate proxy /pos/*). A4. ?print=1 → cetak automatik.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildConsignReport, isUuid, type ConsignSettlement, type Consignor } from '@/lib/pos/consign'
import { fmtKl } from '@/lib/pos/receipt'
import { fmtQty } from '@/lib/pos/money'
import { SELLER } from '@/lib/seller'
import { AutoPrint } from '@/components/pos/auto-print'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Consignment statement', robots: { index: false, follow: false } }

const money = (v: number) => `RM${Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function PosConsignStatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const { id } = await params
  const { print } = await searchParams
  if (!isUuid(id)) notFound()
  const sb = createAdminClient()
  const { data } = await sb.from('pos_consign_settlements').select('*, pos_consignors(*)').eq('id', id).maybeSingle()
  if (!data) notFound()
  const s = data as ConsignSettlement & { pos_consignors: Consignor | null }
  const c = s.pos_consignors
  const report = await buildConsignReport(sb, s.consignor_id, { settlementId: s.id })

  return (
    <div className="pos-consign min-h-dvh" style={{ background: '#fff', color: '#111', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <style>{`html, body, body > div { background: #fff !important; } @page { size: A4; margin: 14mm } .pos-consign { font-size: 13px } .sheet { max-width: 720px; margin: 0 auto; padding: 24px } .pos-consign table { width: 100%; border-collapse: collapse } .pos-consign th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #555; border-bottom: 2px solid #111; padding: 6px 8px } .pos-consign td { padding: 8px; border-bottom: 1px solid #ddd; vertical-align: top } .r { text-align: right } .muted { color: #666 } .big { font-size: 22px; font-weight: 800 } .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px } .line { border-top: 1px solid #111; padding-top: 6px; font-size: 12px } @media print { .noprint { display: none } }`}</style>
      {print === '1' && <AutoPrint />}
      <div className="sheet">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{SELLER.brand}</div>
            <div>{SELLER.name}</div>
            <div className="muted">Reg. {SELLER.regNew} ({SELLER.regOld})</div>
            <div className="muted">{SELLER.addr1}<br />{SELLER.addr2}</div>
            <div className="muted">{SELLER.phone} · {SELLER.email}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="big">CONSIGNMENT STATEMENT</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{s.doc_no}</div>
            <div className="muted">Issued {fmtKl(s.created_at)}</div>
            <div style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '.06em', marginTop: 4, fontWeight: 700 }}>{s.status === 'paid' ? `PAID${s.paid_at ? ` ${fmtKl(s.paid_at)}` : ''}` : 'UNPAID'}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, margin: '24px 0' }}>
          <div><div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Supplier</div><div style={{ fontWeight: 700 }}>{c?.name ?? '—'}</div><div className="muted">{c?.phone ?? ''}</div></div>
          <div><div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Sales period</div><div style={{ fontWeight: 700 }}>{s.period_from} to {s.period_to}</div><div className="muted">{c?.payout_type === 'commission' ? `Store commission ${Number(c.commission_pct)}% unless stated per product` : 'Paid at agreed cost per unit'}</div></div>
        </div>
        <table>
          <thead><tr><th style={{ width: 32 }}>#</th><th>Item</th><th className="r">Qty sold</th><th className="r">Sales</th><th className="r">Payable</th></tr></thead>
          <tbody>
            {report.rows.map((x, i) => (
              <tr key={x.key}><td className="muted">{i + 1}</td><td>{x.name}{x.variant ? <span className="muted"> · {x.variant}</span> : null}</td><td className="r">{fmtQty(x.qty, x.unit)}</td><td className="r">{money(x.sales)}</td><td className="r" style={{ fontWeight: 700 }}>{money(x.payable)}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <table style={{ width: 300 }}><tbody>
            <tr><td className="muted">Total sales</td><td className="r">{money(Number(s.sales_total))}</td></tr>
            <tr><td className="muted">Store commission / margin</td><td className="r">−{money(Number(s.commission_total))}</td></tr>
            <tr><td style={{ fontWeight: 800, borderBottom: '2px solid #111' }}>Amount payable to supplier</td><td className="r" style={{ fontWeight: 800, fontSize: 16, borderBottom: '2px solid #111' }}>{money(Number(s.payable_total))}</td></tr>
          </tbody></table>
        </div>
        {(c?.bank_name || c?.bank_account) && <p style={{ marginTop: 16 }}><span className="muted">Pay to:</span> {[c?.bank_name, c?.bank_account, c?.bank_holder].filter(Boolean).join(' · ')}</p>}
        {s.pay_ref && <p><span className="muted">Payment reference:</span> {s.pay_ref}</p>}
        {s.note && <p><span className="muted">Note:</span> {s.note}</p>}
        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>Based on paid sales recorded by the POS in the period above. Voided sales are excluded. {s.lines} sale line{s.lines === 1 ? '' : 's'}.</p>
        <div className="sig">
          <div className="line">Prepared by ({SELLER.brand})<br /><br />Name / date</div>
          <div className="line">Received by (supplier)<br /><br />Name / date</div>
        </div>
        <div className="noprint" style={{ marginTop: 24 }}>
          <a href={`/pos/consign/${s.id}?print=1`} style={{ padding: '8px 12px', border: '1px solid #111', borderRadius: 8, textDecoration: 'none', color: '#111', fontSize: 13 }}>Print</a>
        </div>
      </div>
    </div>
  )
}
