// Dokumen pindahan (DO) — /pos/do/<id>. Perlu login POS (admin / akaun peranti) — gate proxy /pos/*.
// ?size=80 → kertas terma 80mm; lalai A4. ?print=1 → window.print() automatik. Tanpa harga (keputusan pemilik).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadTransfer } from '@/lib/pos/outlets'
import { fmtKl } from '@/lib/pos/receipt'
import { SELLER } from '@/lib/seller'
import { AutoPrint } from '@/components/pos/auto-print'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Delivery Order', robots: { index: false, follow: false } }

const qtyStr = (q: number, unit: string) => unit === 'kg' ? `${Number(q).toFixed(3).replace(/\.?0+$/, '')} kg` : unit === 'ctn' ? `${Number(q)} ctn` : `${Number(q)} pcs`

export default async function PosTransferDocPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ size?: string; print?: string }> }) {
  const { id } = await params
  const { size, print } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const t = await loadTransfer(createAdminClient(), id)
  if (!t || t.status === 'cancelled') notFound()
  const thermal = size === '80'
  const items = t.pos_transfer_items ?? []
  const title = t.kind === 'return' ? 'RETURN NOTE' : 'DELIVERY ORDER'

  return (
    <div className="pos-do min-h-dvh" style={{ background: '#fff', color: '#111', fontFamily: thermal ? 'ui-monospace, Menlo, monospace' : 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <style>{`html, body, body > div { background: #fff !important; } ` + (thermal
          ? `@page { size: 80mm auto; margin: 3mm } .pos-do { width: 74mm; font-size: 11px; padding: 2mm } table { width: 100%; border-collapse: collapse } td, th { padding: 2px 0; vertical-align: top } .r { text-align: right } .hr { border-top: 1px dashed #000; margin: 6px 0 } .big { font-size: 14px; font-weight: 700 }`
          : `@page { size: A4; margin: 14mm } .pos-do { font-size: 13px; padding: 0 } .sheet { max-width: 720px; margin: 0 auto; padding: 24px } table { width: 100%; border-collapse: collapse } th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #555; border-bottom: 2px solid #111; padding: 6px 8px } td { padding: 8px; border-bottom: 1px solid #ddd; vertical-align: top } .r { text-align: right } .big { font-size: 22px; font-weight: 800; letter-spacing: .02em } .muted { color: #666 } .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px } .line { border-top: 1px solid #111; padding-top: 6px; font-size: 12px } @media print { .noprint { display: none } }`)}</style>
        {print === '1' && <AutoPrint />}
        {thermal ? (
          <div>
            <div className="big">{SELLER.brand}</div>
            <div>{SELLER.name}</div>
            <div>{SELLER.regNew} ({SELLER.regOld})</div>
            <div className="hr" />
            <div className="big">{title}</div>
            <div>No: {t.doc_no ?? 'DRAFT'}</div>
            <div>Date: {fmtKl(t.issued_at ?? t.created_at)}</div>
            <div>From: {t.from_outlet?.code} {t.from_outlet?.name}</div>
            <div>To: {t.to_outlet?.code} {t.to_outlet?.name}</div>
            {t.note && <div>Note: {t.note}</div>}
            <div className="hr" />
            <table><tbody>
              {items.map((i, idx) => (
                <tr key={i.id}><td>{idx + 1}. {i.name}{i.variant_name ? ` ${i.variant_name}` : ''}{i.unit === 'ctn' && i.pack_size ? ` (${Number(i.pack_size)}/ctn)` : ''}</td><td className="r">{qtyStr(Number(i.qty), i.unit)}</td></tr>
              ))}
            </tbody></table>
            <div className="hr" />
            <div>Lines: {items.length}</div>
            <div style={{ marginTop: 18 }}>Issued by: ____________</div>
            <div style={{ marginTop: 18 }}>Received by: ____________</div>
            <div style={{ marginTop: 18 }}>Date/time: ____________</div>
            {t.status === 'confirmed' && <div style={{ marginTop: 8 }}>Confirmed {fmtKl(t.confirmed_at!)}{t.confirmed_cashier?.name ? ` by ${t.confirmed_cashier.name}` : ''}</div>}
          </div>
        ) : (
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
                <div className="big">{title}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{t.doc_no ?? 'DRAFT'}</div>
                <div className="muted">{fmtKl(t.issued_at ?? t.created_at)}</div>
                <div className="muted" style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '.06em', marginTop: 4 }}>{t.status}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, margin: '24px 0' }}>
              <div><div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>From</div><div style={{ fontWeight: 700 }}>{t.from_outlet?.code} · {t.from_outlet?.name}</div><div className="muted">{t.from_outlet?.location ?? ''}</div></div>
              <div><div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Deliver to</div><div style={{ fontWeight: 700 }}>{t.to_outlet?.code} · {t.to_outlet?.name}</div><div className="muted">{t.to_outlet?.location ?? ''}</div></div>
            </div>
            <table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>Item</th><th className="r">Qty</th><th className="r">Pack</th><th className="r">Stock qty</th><th className="r">Received</th></tr></thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={i.id}>
                    <td className="muted">{idx + 1}</td>
                    <td>{i.name}{i.variant_name ? <span className="muted"> · {i.variant_name}</span> : null}{i.note ? <div className="muted" style={{ fontSize: 11 }}>{i.note}</div> : null}</td>
                    <td className="r">{qtyStr(Number(i.qty), i.unit)}</td>
                    <td className="r muted">{i.unit === 'ctn' && i.pack_size ? `${Number(i.pack_size)}/ctn` : '—'}</td>
                    <td className="r" style={{ fontWeight: 700 }}>{qtyStr(Number(i.base_qty), i.base_unit)}</td>
                    <td className="r">{i.received_qty != null ? qtyStr(Number(i.received_qty), i.base_unit) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {t.note && <p style={{ marginTop: 12 }}><span className="muted">Note:</span> {t.note}</p>}
            <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>Internal stock transfer — no charge. Weighed fruit (kg) listed for record. {items.length} line{items.length === 1 ? '' : 's'}.</p>
            <div className="sig">
              <div className="line">Issued by (HQ)<br /><br />Name / date</div>
              <div className="line">Received by (outlet staff on duty)<br /><br />Name / date{t.status === 'confirmed' ? ` — confirmed ${fmtKl(t.confirmed_at!)}${t.confirmed_cashier?.name ? ` by ${t.confirmed_cashier.name}` : ''}` : ''}</div>
            </div>
            <div className="noprint" style={{ marginTop: 24, display: 'flex', gap: 8 }}>
              <a href={`/pos/do/${t.id}?print=1`} style={{ padding: '8px 12px', border: '1px solid #111', borderRadius: 8, textDecoration: 'none', color: '#111', fontSize: 13 }}>Print A4</a>
              <a href={`/pos/do/${t.id}?print=1&size=80`} style={{ padding: '8px 12px', border: '1px solid #111', borderRadius: 8, textDecoration: 'none', color: '#111', fontSize: 13 }}>Print 80mm</a>
            </div>
          </div>
        )}
    </div>
  )
}
