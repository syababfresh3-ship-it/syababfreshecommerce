// Laporan shift — /pos/shift-report/<id>. Shift terbuka = X (langsung); tertutup = Z (ringkasan beku).
// Perlu login POS (gate proxy /pos/*). ?size=58|80 (lalai 80) · ?print=1 → cetak automatik.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildShiftSummary, loadShift } from '@/lib/pos/shifts'
import { fmtKl } from '@/lib/pos/receipt'
import { fmtQty, rm } from '@/lib/pos/money'
import { POS_PAY_LABEL, type PosPayMethod } from '@/lib/pos/types'
import { SELLER } from '@/lib/seller'
import { AutoPrint } from '@/components/pos/auto-print'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Shift report', robots: { index: false, follow: false } }

function Row({ a, b, bold }: { a: string; b: string; bold?: boolean }) {
  return <div className={`flex justify-between gap-3 ${bold ? 'font-black' : ''}`}><span>{a}</span><span className="tabular-nums">{b}</span></div>
}

export default async function PosShiftReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ size?: string; print?: string }> }) {
  const { id } = await params
  const { size, print } = await searchParams
  const sb = createAdminClient()
  const shift = await loadShift(sb, id)
  if (!shift) notFound()
  const closed = shift.status === 'closed'
  const sum = closed && shift.summary ? shift.summary : await buildShiftSummary(sb, shift)
  const paper = size === '58' ? 58 : 80
  const variance = shift.variance ?? 0

  return (
    <div className="min-h-dvh bg-gray-100 py-6 px-3 shift-report-wrap">
      <style>{`
        @page { size: ${paper}mm auto; margin: 2mm; }
        @media print {
          html, body, body > div, .shift-report-wrap { background: #fff !important; padding: 0 !important; }
          .shift-report { width: ${paper === 58 ? '52mm' : '72mm'} !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; font-family: ui-monospace, Menlo, Consolas, monospace !important; font-size: 11px !important; padding: 0 !important; }
          .shift-report .no-print { display: none !important; }
        }
      `}</style>
      {print === '1' && <AutoPrint />}
      <article className="shift-report mx-auto w-full max-w-[360px] bg-white rounded-2xl shadow-sm p-5 text-[12px] text-gray-900 space-y-2">
        <header className="text-center">
          <p className="text-[15px] font-black">{SELLER.brand}</p>
          <p className="font-semibold">{SELLER.name}</p>
          <p className="text-[14px] font-black mt-2">{closed ? 'Z REPORT — STORE CLOSED' : 'X REPORT — STORE OPEN'}</p>
          <p>Register {shift.pos_registers?.code ?? '—'} · {shift.pos_registers?.name ?? ''}</p>
        </header>
        <div className="border-t border-dashed border-gray-400 pt-2">
          <Row a="Opened" b={`${fmtKl(shift.opened_at)}${shift.opener?.name ? ` · ${shift.opener.name}` : ''}`} />
          {closed && <Row a="Closed" b={`${fmtKl(shift.closed_at!)}${shift.closer?.name ? ` · ${shift.closer.name}` : ''}`} />}
          {!closed && <Row a="Printed" b={fmtKl(sum.generatedAt)} />}
        </div>
        <div className="border-t border-dashed border-gray-400 pt-2">
          <Row a={`Sales (${sum.sales})`} b={rm(sum.revenue)} bold />
          <Row a="Discounts given" b={rm(sum.discount)} />
          <Row a="Voided sales" b={String(sum.voids)} />
          {sum.pending > 0 && <Row a="Pending (unpaid)" b={String(sum.pending)} />}
          {sum.weightKg > 0 && <Row a="Sold by weight" b={fmtQty(sum.weightKg, 'kg')} />}
        </div>
        <div className="border-t border-dashed border-gray-400 pt-2">
          <p className="font-bold">Payments</p>
          {(Object.entries(sum.byMethod) as [PosPayMethod, { count: number; amount: number }][]).map(([m, v]) => {
            const dec = m !== 'cash' ? sum.declared?.[m] : undefined
            const dv = sum.tenderVariance?.[m] ?? 0
            return (
              <div key={m}>
                <Row a={`${POS_PAY_LABEL[m]} (${v.count})`} b={rm(v.amount)} />
                {dec != null && <Row a="  Declared at close" b={`${rm(dec)}${dv === 0 ? ' · exact' : ` · ${dv > 0 ? 'over' : 'short'} ${rm(Math.abs(dv))}`}`} bold={dv !== 0} />}
              </div>
            )
          })}
          {Object.keys(sum.byMethod).length === 0 && <p className="text-gray-500">No sales.</p>}
        </div>
        {sum.byCashier.length > 0 && (
          <div className="border-t border-dashed border-gray-400 pt-2">
            <p className="font-bold">Cashiers</p>
            {sum.byCashier.map(c => <Row key={c.name} a={`${c.name} (${c.sales})`} b={rm(c.revenue)} />)}
          </div>
        )}
        <div className="border-t border-dashed border-gray-400 pt-2">
          <p className="font-bold">Cash drawer</p>
          <Row a="Opening float" b={rm(sum.openingFloat)} />
          <Row a="Cash sales" b={rm(sum.cashSales)} />
          <Row a="Cash in" b={rm(sum.cashIn)} />
          <Row a="Cash out" b={`-${rm(sum.cashOut)}`} />
          <Row a="Expected in drawer" b={rm(closed ? (shift.expected_cash ?? sum.expectedCash) : sum.expectedCash)} bold />
          {closed && <Row a="Counted" b={rm(shift.counted_cash ?? 0)} bold />}
          {closed && <Row a={variance === 0 ? 'Difference' : variance > 0 ? 'Over' : 'Short'} b={variance === 0 ? 'Exact' : rm(Math.abs(variance))} bold />}
        </div>
        {sum.movements.length > 0 && (
          <div className="border-t border-dashed border-gray-400 pt-2">
            <p className="font-bold">Cash in / out details</p>
            {sum.movements.map(m => <Row key={m.id} a={`${m.type === 'in' ? 'In' : 'Out'} · ${m.reason ?? '—'}`} b={`${m.type === 'out' ? '-' : ''}${rm(m.amount)}`} />)}
          </div>
        )}
        {shift.notes && <p className="border-t border-dashed border-gray-400 pt-2">Note: {shift.notes}</p>}
        {closed && <div className="pt-6 space-y-5"><p>Closed by: ______________</p><p>Checked by: ______________</p></div>}
        <div className="no-print pt-3 flex gap-2">
          <a href={`/pos/shift-report/${shift.id}?print=1`} className="flex-1 h-10 grid place-items-center rounded-xl bg-gray-900 text-white font-bold">Print 80mm</a>
          <a href={`/pos/shift-report/${shift.id}?print=1&size=58`} className="flex-1 h-10 grid place-items-center rounded-xl border border-gray-300 font-bold">Print 58mm</a>
        </div>
      </article>
    </div>
  )
}
