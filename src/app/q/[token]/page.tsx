export const dynamic = 'force-dynamic'

// Pautan kongsi awam sebut harga: /q/<token> — lihat, muat turun PDF, terima.
// Token 32 hex (quotations.share_token). noindex. Tiada header kedai (root layout kosong).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Download, MessageCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitDb } from '@/lib/rate-limit-db'
import { loadPdfAssets, loadQuotationByToken, logQuotationEvent } from '@/lib/quotation-server'
import { calcTotals, isExpired, rm } from '@/lib/quotation'
import { ringgitInWords } from '@/lib/number-words'
import { SELLER, bankFor } from '@/lib/seller'
import { AcceptForm } from './accept-form'

export const metadata: Metadata = { title: 'Quotation — Syabab Trading Sdn Bhd', robots: { index: false, follow: false } }

const fmtDate = (v: string | null | undefined) => v ? new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default async function PublicQuotationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const sb = createAdminClient()
  const q = await loadQuotationByToken(sb, token)
  if (!q || q.status === 'draft' || !q.quote_number) notFound()

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  if (await rateLimitDb(`q-view:${token}:${ip}`, 1, 3_600_000)) await logQuotationEvent(sb, q.id, 'viewed', { ip }, 'client')

  const t = calcTotals(q.items, q.discount, q.charges)
  const expired = isExpired(q)
  const bank = bankFor(q.bank_key)
  const assets = await loadPdfAssets()
  const c = q.client
  const banner =
    q.status === 'accepted' ? { cls: 'bg-green-50 border-green-200 text-green-800', text: `Accepted on ${fmtDate(q.accepted_at)}${q.accepted_by ? ` by ${q.accepted_by}` : ''}.` }
    : q.status === 'cancelled' ? { cls: 'bg-red-50 border-red-200 text-red-800', text: 'This quotation has been cancelled.' }
    : q.status === 'converted' ? { cls: 'bg-blue-50 border-blue-200 text-blue-800', text: 'This quotation has been invoiced.' }
    : (expired || q.status === 'expired') ? { cls: 'bg-amber-50 border-amber-200 text-amber-800', text: `This quotation expired on ${fmtDate(q.valid_until)}. Please contact us for an updated quotation.` }
    : null

  return (
    <main className="min-h-screen bg-[#f4f4f2] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {banner && <div className={`rounded-xl border px-4 py-3 text-sm font-semibold mb-4 ${banner.cls}`} role="status">{banner.text}</div>}

        <article className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {assets.logo ? <img src="/brand/quotation-logo.png" alt="Syabab" className="h-16 w-16 object-contain" /> : <p className="text-xl font-black text-gray-900">{SELLER.brand}</p>}
              <p className="text-xs text-gray-500 mt-1">{SELLER.name} ({SELLER.regNew})</p>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-black tracking-wide text-gray-900">QUOTATION</h1>
              <dl className="text-sm mt-1 space-y-0.5">
                <div className="flex justify-end gap-2"><dt className="text-gray-500">Quotation No</dt><dd className="font-bold text-gray-900">{q.quote_number}</dd></div>
                <div className="flex justify-end gap-2"><dt className="text-gray-500">Date</dt><dd className="font-bold text-gray-900">{fmtDate(q.issued_at)}</dd></div>
                {q.valid_until && <div className="flex justify-end gap-2"><dt className="text-gray-500">Valid until</dt><dd className="font-bold text-gray-900">{fmtDate(q.valid_until)}</dd></div>}
                {q.needed_by && <div className="flex justify-end gap-2"><dt className="text-gray-500">Required delivery</dt><dd className="font-bold text-gray-900">{fmtDate(q.needed_by)}</dd></div>}
              </dl>
            </div>
          </header>

          <section className="grid sm:grid-cols-2 gap-3 mt-6">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm">
              <p className="text-[10px] font-bold tracking-widest text-[#E11D2A]">QUOTATION FROM</p>
              <p className="font-bold text-gray-900 mt-1">{SELLER.name.toUpperCase()}</p>
              <p className="text-xs text-gray-500">Reg. No. {SELLER.regNew} ({SELLER.regOld}) · TIN {SELLER.tin}</p>
              <p className="text-gray-700 mt-1">{SELLER.addr1} {SELLER.addr2}</p>
              <p className="text-gray-700 mt-1">Email: {SELLER.email}<br />Phone: {SELLER.phoneSales}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm">
              <p className="text-[10px] font-bold tracking-widest text-[#E11D2A]">QUOTATION FOR</p>
              <p className="font-bold text-gray-900 mt-1">{(c.company || c.name || '—').toUpperCase()}</p>
              {c.company && c.name && <p className="text-gray-700">Attn: {c.attn || c.name}</p>}
              {(c.reg_no || c.tin) && <p className="text-xs text-gray-500">{[c.reg_no ? `Reg. No. ${c.reg_no}` : null, c.tin ? `TIN ${c.tin}` : null].filter(Boolean).join(' · ')}</p>}
              {c.address && <p className="text-gray-700 mt-1">{c.address}</p>}
              {(c.email || c.phone) && <p className="text-gray-700 mt-1">{c.email && <>Email: {c.email}<br /></>}{c.phone && <>Phone: {c.phone}</>}</p>}
            </div>
          </section>

          {q.custom_fields.length > 0 && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm">
              {q.custom_fields.map((f, i) => <div key={i}><dt className="inline text-gray-500">{f.label}: </dt><dd className="inline font-semibold text-gray-900">{f.value}</dd></div>)}
            </dl>
          )}

          {/* Telefon: setiap item jadi kad; ≥sm: jadual */}
          <ul className="sm:hidden mt-6 divide-y divide-gray-100 border-t border-b border-gray-100">
            {q.items.map((it, i) => (
              <li key={i} className="py-3">
                <p className="font-semibold text-gray-900"><span className="text-gray-400 mr-1.5">{i + 1}.</span>{it.name}</p>
                {it.description && <p className="text-xs text-gray-500 mt-0.5">{it.description}</p>}
                <div className="flex items-center justify-between mt-1.5 text-sm">
                  <span className="text-gray-500">{it.qty.toLocaleString('en-MY', { maximumFractionDigits: 3 })} {it.unit} × {rm(it.rate)}</span>
                  <span className="font-bold text-gray-900">{rm(it.qty * it.rate)}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block mt-6 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-gray-900 text-white text-[11px] tracking-wide">
                  <th className="text-left font-bold px-3 py-2 rounded-l-md w-8">#</th>
                  <th className="text-left font-bold px-3 py-2">ITEM</th>
                  <th className="text-right font-bold px-3 py-2">QTY</th>
                  <th className="text-center font-bold px-3 py-2">UNIT</th>
                  <th className="text-right font-bold px-3 py-2">RATE</th>
                  <th className="text-right font-bold px-3 py-2 rounded-r-md">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-3 text-gray-400">{i + 1}.</td>
                    <td className="px-3 py-3"><p className="font-semibold text-gray-900">{it.name}</p>{it.description && <p className="text-xs text-gray-500 mt-0.5">{it.description}</p>}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{it.qty.toLocaleString('en-MY', { maximumFractionDigits: 3 })}</td>
                    <td className="px-3 py-3 text-center text-gray-500 uppercase text-xs">{it.unit}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{rm(it.rate)}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900">{rm(it.qty * it.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="flex flex-wrap justify-between gap-4 mt-5">
            <div className="text-sm max-w-xs">
              <p className="text-[10px] font-bold tracking-widest text-gray-400">TOTAL IN WORDS</p>
              <p className="font-bold text-gray-900 mt-1">{ringgitInWords(t.total)}</p>
            </div>
            <dl className="text-sm w-full sm:w-64 space-y-1">
              {(t.discount > 0 || q.charges.length > 0) && <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{rm(t.subtotal)}</dd></div>}
              {t.discount > 0 && <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd className="text-green-700">- {rm(t.discount)}</dd></div>}
              {q.charges.map((ch, i) => <div key={i} className="flex justify-between"><dt className="text-gray-500">{ch.label}</dt><dd>{rm(ch.amount)}</dd></div>)}
              <div className="flex justify-between border-t-2 border-gray-900 pt-2 mt-1"><dt className="font-bold text-gray-900">TOTAL ({q.currency})</dt><dd className="font-black text-lg text-[#E11D2A]">{rm(t.total)}</dd></div>
            </dl>
          </section>

          <section className="flex flex-wrap items-end justify-between gap-4 mt-6">
            {q.show_bank ? (
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm w-full sm:w-72">
                <p className="text-[10px] font-bold tracking-widest text-[#E11D2A]">BANK DETAILS</p>
                <p className="text-gray-700 mt-1">Bank: <b>{bank.name}</b><br />Account name: <b>{bank.accName}</b><br />Account no.: <b>{bank.accNo}</b></p>
                <p className="text-xs text-gray-500 mt-2">Please email the payment receipt to {SELLER.email}.</p>
              </div>
            ) : <div />}
            <div className="text-center w-full sm:w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {assets.stamp && <img src="/brand/stamp-syabab-trading.png" alt="Company stamp" className="h-24 w-24 object-contain mx-auto" />}
              <p className="text-[11px] text-gray-500 mt-1">This is computer generated, no signature required</p>
            </div>
          </section>

          {q.terms.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-bold text-gray-900">Terms and Conditions</h2>
              <ol className="mt-2 space-y-1 text-sm text-gray-700">
                {q.terms.map((term, i) => <li key={i} className="flex gap-2"><span className="text-gray-400 w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span><span>{term}</span></li>)}
              </ol>
            </section>
          )}
          {q.notes && <section className="mt-5"><h2 className="text-sm font-bold text-gray-900">Notes</h2><p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{q.notes}</p></section>}
        </article>

        <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-4 items-start">
          {q.status === 'issued' && !expired
            ? <AcceptForm token={token} quoteNumber={q.quote_number} />
            : <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">{banner?.text ?? 'This quotation is not open for acceptance.'}</div>}
          <div className="flex sm:flex-col gap-2">
            <a href={`/api/q/${token}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 border border-gray-300 bg-white text-gray-900 font-bold text-sm px-4 py-3 rounded-xl hover:bg-gray-50"><Download className="h-4 w-4" />Download PDF</a>
            <a href="https://wa.me/601156403601" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 border border-gray-300 bg-white text-gray-900 font-bold text-sm px-4 py-3 rounded-xl hover:bg-gray-50"><MessageCircle className="h-4 w-4" />WhatsApp us</a>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-6">{SELLER.name} ({SELLER.regNew}) · {SELLER.addr1} {SELLER.addr2}</p>
      </div>
    </main>
  )
}
