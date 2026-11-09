// Resit POS awam — /pos/resit/<token> (token rawak, bukan id). Dibenarkan tanpa login (proxy).
// ?print=58|80 → CSS kertas terma + cetak automatik (dibuka window.open dari paparan berjaya).
// Bahasa Inggeris (keputusan pemilik 9 Nov). Tiada baris cukai melainkan COMPANY.facts.sstRegistered diisi.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadSaleDetail } from '@/lib/pos/sale'
import { getAppSettings } from '@/lib/app-settings'
import { POS_SETTINGS_KEY, parsePosSettings } from '@/lib/pos/settings'
import { fmtKl } from '@/lib/pos/receipt'
import { fmtQty, rm } from '@/lib/pos/money'
import { POS_PAY_LABEL } from '@/lib/pos/types'
import { SELLER } from '@/lib/seller'
import { hasFact } from '@/lib/company'
import { AutoPrint } from '@/components/pos/auto-print'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Receipt', robots: { index: false, follow: false } }

export default async function PosReceiptPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ print?: string }> }) {
  const { token } = await params
  const { print } = await searchParams
  if (!/^[0-9a-f]{18}$/.test(token)) notFound()
  const d = await loadSaleDetail(createAdminClient(), { token })
  if (!d) notFound()
  const settings = parsePosSettings((await getAppSettings())[POS_SETTINGS_KEY])
  const paper = print === '58' ? 58 : print === '80' ? 80 : null
  const { sale, items, payments } = d
  const paid = payments.filter(p => p.status === 'paid')

  return (
    <div className={paper ? 'bg-white' : 'min-h-dvh bg-gray-100 py-6 px-3'}>
      {paper && (
        <style>{`
          @page { size: ${paper}mm auto; margin: 2mm; }
          html, body { background: #fff !important; }
          .pos-receipt { width: ${paper === 58 ? '52mm' : '72mm'} !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; font-family: ui-monospace, Menlo, Consolas, monospace !important; font-size: 11px !important; padding: 0 !important; }
          .pos-receipt .no-print { display: none !important; }
        `}</style>
      )}
      {paper && <AutoPrint />}
      <article className="pos-receipt mx-auto w-full max-w-[360px] bg-white rounded-2xl shadow-sm p-5 text-[12px] text-gray-900">
        <header className="text-center">
          <p className="text-[15px] font-black">{SELLER.brand}</p>
          <p className="font-semibold">{SELLER.name}</p>
          <p className="text-gray-600">{SELLER.regNew} ({SELLER.regOld}) · TIN {SELLER.tin}</p>
          <p className="text-gray-600">{SELLER.addr1} {SELLER.addr2}</p>
          <p className="text-gray-600">{SELLER.phone}</p>
          {settings.receiptHeader && <p className="mt-1 whitespace-pre-line">{settings.receiptHeader}</p>}
        </header>
        <hr className="my-3 border-dashed border-gray-300" />
        <div className="flex justify-between gap-2"><span>Receipt no.</span><span className="font-bold">{sale.receipt_no ?? sale.local_ref ?? '-'}</span></div>
        {sale.receipt_no && sale.local_ref && <div className="flex justify-between gap-2 text-gray-500"><span>Local ref.</span><span>{sale.local_ref}</span></div>}
        <div className="flex justify-between gap-2"><span>Date</span><span>{fmtKl(sale.sold_at)}</span></div>
        {(d.registerCode || d.cashierName) && <div className="flex justify-between gap-2"><span>Counter</span><span>{[d.registerCode, d.cashierName?.split(' ')[0]].filter(Boolean).join(' · ')}</span></div>}
        {sale.customer_name && <div className="flex justify-between gap-2"><span>Customer</span><span>{sale.customer_name}</span></div>}
        <hr className="my-3 border-dashed border-gray-300" />
        <ul className="space-y-1.5">
          {items.map(it => (
            <li key={it.id}>
              <div className="font-bold">{it.name}{it.variant_name && it.variant_name !== 'ikut berat' ? ` ${it.variant_name}` : ''}</div>
              <div className="flex justify-between gap-2 text-gray-700">
                <span>{it.unit === 'kg' ? `${fmtQty(Number(it.qty), 'kg')} × ${rm(Number(it.unit_price))}/kg` : `${fmtQty(Number(it.qty), 'pcs')} × ${rm(Number(it.unit_price))}`}{Number(it.line_discount) > 0 ? ` − ${rm(Number(it.line_discount))}` : ''}</span>
                <span className="font-semibold tabular-nums">{rm(Number(it.line_total))}</span>
              </div>
            </li>
          ))}
        </ul>
        <hr className="my-3 border-dashed border-gray-300" />
        <div className="space-y-1 tabular-nums">
          <div className="flex justify-between"><span>Subtotal</span><span>{rm(Number(sale.subtotal))}</span></div>
          {Number(sale.discount_total) > 0 && <div className="flex justify-between"><span>Discount{sale.discount_note ? ` (${sale.discount_note})` : ''}</span><span>−{rm(Number(sale.discount_total))}</span></div>}
          {Number(sale.promo_discount) > 0 && <div className="flex justify-between"><span>Promo {sale.promo_code}</span><span>−{rm(Number(sale.promo_discount))}</span></div>}
          {Number(sale.rounding_adj) !== 0 && <div className="flex justify-between"><span>Rounding</span><span>{Number(sale.rounding_adj) > 0 ? '+' : '−'}{rm(Math.abs(Number(sale.rounding_adj)))}</span></div>}
          <div className="flex justify-between text-[15px] font-black pt-1"><span>TOTAL</span><span>{rm(Number(sale.total))}</span></div>
          {hasFact('sstRegistered') && <p className="text-gray-500 text-[11px]">Prices include SST.</p>}
        </div>
        <hr className="my-3 border-dashed border-gray-300" />
        <div className="space-y-1 tabular-nums">
          {paid.map(p => (
            <div key={p.id}>
              <div className="flex justify-between"><span>{POS_PAY_LABEL[p.method]}{p.ref ? ` · ${p.ref}` : ''}</span><span>{rm(Number(p.amount))}</span></div>
              {p.method === 'cash' && p.tendered != null && (
                <div className="flex justify-between text-gray-600"><span>Cash received / Change</span><span>{rm(Number(p.tendered))} / {rm(Number(p.change_given ?? 0))}</span></div>
              )}
            </div>
          ))}
          {sale.status === 'pending' && <p className="font-bold text-amber-700">Payment incomplete.</p>}
          {sale.status === 'void' && <p className="font-black">** RECEIPT VOIDED **{sale.void_reason ? ` — ${sale.void_reason}` : ''}</p>}
        </div>
        {sale.weight_kg_total > 0 && <p className="mt-2 text-gray-500">Weighed items: {fmtQty(Number(sale.weight_kg_total), 'kg')}</p>}
        <hr className="my-3 border-dashed border-gray-300" />
        <footer className="text-center text-gray-700 whitespace-pre-line">{settings.receiptFooter}</footer>
        {!paper && (
          <div className="no-print mt-5 flex gap-2">
            <a href={`?print=${settings.paperWidth}`} target="_blank" rel="noreferrer" className="flex-1 h-11 grid place-items-center rounded-xl border border-gray-300 font-bold text-[13px]">Print {settings.paperWidth}mm</a>
          </div>
        )}
      </article>
    </div>
  )
}
