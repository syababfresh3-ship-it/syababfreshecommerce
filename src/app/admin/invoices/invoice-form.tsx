'use client'

// Borang cipta invois terus di Refrens — susunan & label ikut borang Refrens (pemilik: "tak pening
// kalau cross 2 sistem"). Medan yang API Refrens tak terima (Billed By, bank, tandatangan/cop,
// lampiran) dipaparkan baca sahaja: Refrens isi dari tetapan akaun. POST /api/admin/refrens/invoices
// → invois SEBENAR (tiada sandbox) → pengesahan dua langkah. "Save & Create New" = cipta lalu kosongkan.
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, Plus, Trash2, Search, ExternalLink, FileText, CheckCircle2, X } from 'lucide-react'
import { DEFAULT_TERMS, UNITS, calcTotals, rm, type QuotationClient, type QuotationItem } from '@/lib/quotation'
import { ringgitInWords } from '@/lib/number-words'
import { SELLER, BANKS } from '@/lib/seller'

interface FormItem { name: string; description: string; showDesc: boolean; qty: string; unit: string; rate: string }
interface CustomerHit { source?: 'web' | 'refrens'; id: string | null; refrens_id?: string | null; name: string | null; phone_norm: string | null; email: string | null; address: string | null; company?: string | null; company_reg_no?: string | null; tin?: string | null; billing_address?: string | null }
interface Created { number: string; status: string; total: number | null; pdf: string | null; link: string | null; id: string }

const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1'
const card = 'rounded-xl border border-gray-200 bg-white p-4'
const btnSm = 'h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-40'
const btnPrimary = 'inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50'
const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50'
const linkBtn = 'inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900'
const n2 = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }
const emptyItem = (): FormItem => ({ name: '', description: '', showDesc: false, qty: '1', unit: 'pcs', rate: '0' })
const bank = BANKS.publicbank

export function InvoiceForm() {
  const [title, setTitle] = useState('Invoice')
  const [subtitle, setSubtitle] = useState('')
  const [showSub, setShowSub] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [lastNo, setLastNo] = useState<string | null>(null)
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [dueDate, setDueDate] = useState(plusDays(14))
  const [showDue, setShowDue] = useState(true)
  const [client, setClient] = useState<QuotationClient>({})
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [clientMode, setClientMode] = useState<'select' | 'new'>('select')
  const [items, setItems] = useState<FormItem[]>([emptyItem()])
  const [discount, setDiscount] = useState('')
  const [showDiscount, setShowDiscount] = useState(false)
  const [charges, setCharges] = useState<{ label: string; amount: string }[]>([])
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [terms, setTerms] = useState<string[]>([...DEFAULT_TERMS])
  const [sendEmail, setSendEmail] = useState(false)
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'continue' | 'new'>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/admin/refrens/invoices?type=INVOICE&limit=1').then(r => r.ok ? r.json() : null).then(j => { const d = j?.data?.[0]; if (d?.number) setLastNo(`${d.number}${d.date ? ` (${new Date(d.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })})` : ''}`) }).catch(() => {})
  }, [])
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (search.trim().length < 2) { setHits([]); return }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/quotations/customers?q=${encodeURIComponent(search.trim())}`)
      const j = await res.json().catch(() => [])
      setHits(Array.isArray(j) ? j : [])
    }, 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [search])

  const totals = useMemo(() => calcTotals(
    items.map(i => ({ name: i.name, description: null, qty: n2(i.qty), unit: i.unit, rate: n2(i.rate) } as QuotationItem)),
    n2(discount), charges.map(c => ({ label: c.label, amount: n2(c.amount) })),
  ), [items, discount, charges])
  const updClient = (p: Partial<QuotationClient>) => setClient(c => ({ ...c, ...p }))
  const updItem = (i: number, p: Partial<FormItem>) => setItems(xs => xs.map((it, k) => k === i ? { ...it, ...p } : it))
  const valid = !!(client.company || client.name) && items.some(i => i.name.trim() && n2(i.qty) > 0) && !!invoiceDate

  function pick(c: CustomerHit) {
    setClient({ company: c.company ?? null, name: c.name ?? null, phone: c.phone_norm ? `+${c.phone_norm}` : null, email: c.email ?? null, address: c.billing_address ?? c.address ?? null, reg_no: c.company_reg_no ?? null, tin: c.tin ?? null })
    setCustomerId(c.id); setSearch(''); setHits([]); setClientMode('new')
  }
  function resetForm() {
    setTitle('Invoice'); setSubtitle(''); setShowSub(false); setInvoiceNo(''); setInvoiceDate(today()); setDueDate(plusDays(14))
    setClient({}); setCustomerId(null); setClientMode('select'); setItems([emptyItem()]); setDiscount(''); setShowDiscount(false); setCharges([])
    setNotes(''); setShowNotes(false); setTerms([...DEFAULT_TERMS]); setSendEmail(false)
  }
  async function create(mode: 'continue' | 'new') {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/refrens/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        title, subtitle, invoice_number: invoiceNo, invoice_date: invoiceDate, due_date: showDue ? dueDate : null,
        client, customer_id: customerId,
        items: items.map(i => ({ name: i.name, description: i.showDesc ? i.description || null : null, qty: n2(i.qty), unit: i.unit, rate: n2(i.rate) })),
        discount: n2(discount), charges: charges.map(c => ({ label: c.label, amount: n2(c.amount) })), terms, notes, send_email: sendEmail,
      }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal cipta invois'); return }
      toast.success(`Invois ${j.invoice?.number} dicipta di Refrens`)
      if (mode === 'new') { resetForm(); return }
      setCreated(j.invoice); setCreatedUrl(j.url ?? null)
    } finally { setBusy(false); setConfirm(null) }
  }

  if (created) {
    return (
      <div className="max-w-xl space-y-4">
        <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="h-4 w-4" />Invois Refrens</Link>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <p className="font-bold text-gray-900 mt-2">Invoice {created.number} created in Refrens</p>
          <p className="text-sm text-gray-600 mt-1">Status {created.status}{created.total !== null ? ` · ${rm(created.total)}` : ''}. {sendEmail && client.email ? `Refrens emailed ${client.email}.` : 'Email not sent.'}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {created.pdf && <a href={created.pdf} target="_blank" rel="noreferrer" className={btnGhost}><FileText className="h-4 w-4" />PDF</a>}
            {created.link && <a href={created.link} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="h-4 w-4" />Client link</a>}
            {createdUrl && <a href={createdUrl} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="h-4 w-4" />Open in Refrens</a>}
            <button type="button" onClick={() => { setCreated(null); resetForm() }} className={btnGhost}><Plus className="h-4 w-4" />Create another</button>
            <Link href="/admin/invoices" className={btnPrimary}>Invoice list</Link>
          </div>
        </div>
      </div>
    )
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {confirm
        ? <span className="inline-flex items-center gap-2 text-sm"><span className="text-gray-600">Create a real invoice for {rm(totals.total)} in Refrens?</span><button type="button" onClick={() => create(confirm)} disabled={busy} className="font-bold text-gray-900 inline-flex items-center gap-1">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Yes</button><button type="button" onClick={() => setConfirm(null)} className="text-gray-500">No</button></span>
        : <>
          <button type="button" onClick={() => setConfirm('continue')} disabled={!valid || busy} className={btnPrimary}>Save &amp; Continue</button>
          <button type="button" onClick={() => setConfirm('new')} disabled={!valid || busy} className={btnGhost}>Save &amp; Create New</button>
        </>}
    </div>
  )

  return (
    <div className="space-y-4">
      <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="h-4 w-4" />Invois Refrens</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create New Invoice</h1>
          <p className="text-sm text-gray-500">Disimpan terus ke akaun Refrens. Butiran syarikat, bank, cop dan logo diisi Refrens dari tetapan akaun.</p>
        </div>
        {actions}
      </div>

      <div className={card}>
        {/* Tajuk + subtajuk */}
        <div className="text-center mb-5">
          <input value={title} onChange={e => setTitle(e.target.value)} className="text-2xl font-bold text-gray-900 text-center border-b border-dashed border-gray-300 focus:outline-none focus:border-gray-900 bg-transparent w-56" aria-label="Invoice title" />
          <div className="mt-1">{showSub ? <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtitle" className="text-sm text-gray-600 text-center border-b border-dashed border-gray-300 focus:outline-none bg-transparent w-72" /> : <button type="button" onClick={() => setShowSub(true)} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add Subtitle</button>}</div>
        </div>

        {/* Nombor & tarikh */}
        <div className="grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center max-w-xl">
          <label className="text-sm font-semibold text-gray-700">Invoice No</label>
          <div><input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Auto (ikut siri Refrens)" className={`${inp} max-w-xs font-mono`} />{lastNo && <p className="text-[11px] text-gray-400 mt-1">Last No: {lastNo}</p>}</div>
          <label className="text-sm font-semibold text-gray-700">Invoice Date*</label>
          <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={`${inp} max-w-xs`} />
          <label className="text-sm font-semibold text-gray-700">Due date</label>
          <div className="flex items-center gap-2">{showDue ? <><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`${inp} max-w-xs`} /><button type="button" onClick={() => setShowDue(false)} className={btnSm} aria-label="Buang tarikh akhir"><X className="h-3.5 w-3.5" /></button></> : <button type="button" onClick={() => { setShowDue(true); setDueDate(plusDays(14)) }} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add due date</button>}</div>
        </div>

        {/* Billed By / Billed To */}
        <div className="grid lg:grid-cols-2 gap-4 mt-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="font-bold text-gray-900">Billed By <span className="text-xs font-normal text-gray-500">(Your Details)</span></p>
            <p className="text-sm font-semibold text-gray-900 mt-2">{SELLER.name.toUpperCase()} ({SELLER.regOld})</p>
            <p className="text-sm text-gray-600">{SELLER.addr1} {SELLER.addr2}</p>
            <p className="text-sm text-gray-600 mt-1">Email {SELLER.email}<br />Phone {SELLER.phoneSales}</p>
            <p className="text-[11px] text-gray-400 mt-2">Diisi Refrens dari tetapan perniagaan.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-gray-900">Billed To <span className="text-xs font-normal text-gray-500">(Client&apos;s Details)</span></p>
              {clientMode === 'new' && <button type="button" onClick={() => { setClient({}); setCustomerId(null); setClientMode('select') }} className={linkBtn}><X className="h-3.5 w-3.5" />Change client</button>}
            </div>
            {clientMode === 'select' ? (
              <div className="mt-3">
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Select a Client (cari nama / syarikat / telefon)" className={`${inp} pl-8`} />
                  {hits.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg text-sm">
                      {hits.map(h => <li key={h.id}><button type="button" onClick={() => pick(h)} className="w-full text-left px-3 py-2 hover:bg-gray-50"><span className="font-semibold text-gray-900">{h.company || h.name || '—'}</span><span className="block text-xs text-gray-500">{h.source === 'refrens' && <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-gray-900 text-white px-1 py-px rounded mr-1.5 align-middle">Refrens</span>}{[h.company ? h.name : null, h.phone_norm, h.email].filter(Boolean).join(' · ')}</span></button></li>)}
                    </ul>
                  )}
                </div>
                <p className="text-center text-xs text-gray-400 my-3">OR</p>
                <button type="button" onClick={() => setClientMode('new')} className={`${btnPrimary} w-full justify-center`}><Plus className="h-4 w-4" />Add New Client</button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div><label className={lbl}>Business / Client name*</label><input value={client.company ?? ''} onChange={e => updClient({ company: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>Contact person</label><input value={client.name ?? ''} onChange={e => updClient({ name: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>Email</label><input type="email" value={client.email ?? ''} onChange={e => updClient({ email: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>Phone</label><input value={client.phone ?? ''} onChange={e => updClient({ phone: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>Registration No. (SSM)</label><input value={client.reg_no ?? ''} onChange={e => updClient({ reg_no: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>TIN</label><input value={client.tin ?? ''} onChange={e => updClient({ tin: e.target.value })} className={inp} /></div>
                <div className="sm:col-span-2"><label className={lbl}>Address</label><textarea value={client.address ?? ''} onChange={e => updClient({ address: e.target.value })} rows={2} className={inp} /></div>
                <p className="sm:col-span-2 text-[11px] text-gray-400">Klien dicari di Refrens ikut email/telefon; jika tiada, dicipta automatik.</p>
              </div>
            )}
          </div>
        </div>

        {/* Mata wang */}
        <div className="flex flex-wrap items-center gap-3 mt-5 text-sm">
          <span className="font-semibold text-gray-700">Currency*</span>
          <span className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-600">Malaysian Ringgit (MYR, RM)</span>
          <span className="text-xs text-gray-400">SST tiada (syarikat belum berdaftar SST).</span>
        </div>

        {/* Jadual item */}
        <div className="mt-4 rounded-lg overflow-hidden border border-gray-200">
          <div className="hidden md:grid grid-cols-[1fr_90px_90px_90px_120px_130px_44px] gap-2 bg-gray-900 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-2"><span>Item</span><span>Code</span><span className="text-right">Quantity</span><span>Unit</span><span className="text-right">Rate</span><span className="text-right">Amount</span><span /></div>
          <datalist id="invoice-units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
          <div className="divide-y divide-gray-100">
            {items.map((it, i) => (
              <div key={i} className="grid md:grid-cols-[1fr_90px_90px_90px_120px_130px_44px] gap-2 items-start p-2">
                <div className="space-y-1">
                  <input value={it.name} onChange={e => updItem(i, { name: e.target.value })} placeholder={`${i + 1}. Item Name`} className={`${inp} font-semibold`} />
                  {it.showDesc ? <textarea value={it.description} onChange={e => updItem(i, { description: e.target.value })} placeholder="Description" rows={2} className={`${inp} text-xs`} /> : <button type="button" onClick={() => updItem(i, { showDesc: true })} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add Description</button>}
                </div>
                <input value="" disabled placeholder="—" title="Kod item tidak disokong API Refrens" className={`${inp} hidden md:block`} aria-label="Code" />
                <div className="grid grid-cols-3 gap-2 md:contents">
                  <input type="number" min="0" step="any" value={it.qty} onChange={e => updItem(i, { qty: e.target.value })} placeholder="Qty" className={`${inp} text-right font-mono`} aria-label="Quantity" />
                  <input list="invoice-units" value={it.unit} onChange={e => updItem(i, { unit: e.target.value })} placeholder="Unit" className={inp} aria-label="Unit" />
                  <input type="number" min="0" step="0.01" value={it.rate} onChange={e => updItem(i, { rate: e.target.value })} placeholder="Rate" className={`${inp} text-right font-mono`} aria-label="Rate" />
                </div>
                <div className="flex items-center justify-between gap-2 md:contents">
                  <div className="text-sm font-bold text-gray-900 text-right py-1.5 font-mono"><span className="md:hidden text-[11px] font-semibold text-gray-400 mr-2">Amount</span>{rm(n2(it.qty) * n2(it.rate))}</div>
                  <button type="button" onClick={() => setItems(xs => xs.filter((_, k) => k !== i))} disabled={items.length === 1} className={btnSm} aria-label="Remove line"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => setItems(xs => [...xs, emptyItem()])} className="mt-2 w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm font-semibold text-gray-600 hover:border-gray-500 inline-flex items-center justify-center gap-1"><Plus className="h-4 w-4" />Add New Line</button>

        {/* Bank (kiri) + jumlah (kanan) */}
        <div className="grid lg:grid-cols-2 gap-4 mt-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-gray-800">Show Bank Account Details</p><span className="text-[11px] font-bold text-gray-500 border border-gray-200 rounded-full px-2 py-0.5 bg-white">Ikut tetapan Refrens</span></div>
            <p className="text-sm font-semibold text-gray-900 mt-2">{bank.accName}</p>
            <p className="text-sm text-gray-600">Bank: {bank.name} · Acc. No: {bank.accNo}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="space-y-2">
              {showDiscount ? <div className="flex items-center gap-2"><label className="text-sm text-gray-700 w-40">Discount (RM)</label><input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className={`${inp} w-36 font-mono text-right`} /><button type="button" onClick={() => { setShowDiscount(false); setDiscount('') }} className={btnSm} aria-label="Remove discount"><X className="h-3.5 w-3.5" /></button></div>
                : <button type="button" onClick={() => setShowDiscount(true)} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add Discounts</button>}
              {charges.map((ch, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={ch.label} onChange={e => setCharges(cs => cs.map((x, k) => k === i ? { ...x, label: e.target.value } : x))} placeholder="Charge name" className={`${inp} w-40`} />
                  <input type="number" min="0" step="0.01" value={ch.amount} onChange={e => setCharges(cs => cs.map((x, k) => k === i ? { ...x, amount: e.target.value } : x))} className={`${inp} w-36 font-mono text-right`} />
                  <button type="button" onClick={() => setCharges(cs => cs.filter((_, k) => k !== i))} className={btnSm} aria-label="Remove charge"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {charges.length < 10 && <button type="button" onClick={() => setCharges(cs => [...cs, { label: '', amount: '0' }])} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add Additional Charges</button>}
            </div>
            <dl className="text-sm mt-4 space-y-1">
              {(totals.discount > 0 || totals.chargesTotal > 0) && <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd className="font-mono">{rm(totals.subtotal)}</dd></div>}
              {totals.discount > 0 && <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd className="font-mono text-green-700">- {rm(totals.discount)}</dd></div>}
              {totals.chargesTotal > 0 && <div className="flex justify-between"><dt className="text-gray-500">Additional charges</dt><dd className="font-mono">{rm(totals.chargesTotal)}</dd></div>}
              <div className="flex justify-between border-t-2 border-gray-900 pt-2 mt-1"><dt className="font-bold text-gray-900">Total (MYR)</dt><dd className="font-black text-lg font-mono">{rm(totals.total)}</dd></div>
            </dl>
            <p className="text-xs text-gray-500 mt-3"><span className="font-semibold text-gray-700">Total (in words)</span><br />{ringgitInWords(totals.total)}</p>
          </div>
        </div>

        {/* Tandatangan / cop */}
        <div className="flex flex-wrap items-end justify-end gap-3 mt-5">
          <div className="text-center">
            <div className="h-16 w-16 mx-auto rounded-full border-2 border-dashed border-gray-300 grid place-items-center text-[10px] font-bold text-gray-400">COP</div>
            <p className="text-[11px] text-gray-500 mt-1">This is computer generated no signature required</p>
            <p className="text-[11px] text-gray-400">Tandatangan & cop ikut tetapan Refrens.</p>
          </div>
        </div>

        {/* Nota, terma, email */}
        <div className="mt-5 space-y-4">
          {showNotes ? <div><label className={lbl}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp} /></div> : <button type="button" onClick={() => setShowNotes(true)} className={btnGhost}><Plus className="h-4 w-4" />Add Notes</button>}
          <div>
            <p className="text-sm font-bold text-gray-900 mb-2">Terms and Conditions</p>
            <div className="space-y-2">
              {terms.map((t, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-xs text-gray-400 pt-2 w-5">{String(i + 1).padStart(2, '0')}</span>
                  <textarea value={t} onChange={e => setTerms(ts => ts.map((x, k) => k === i ? e.target.value : x))} rows={2} className={inp} />
                  <button type="button" onClick={() => setTerms(ts => ts.filter((_, k) => k !== i))} className={btnSm} aria-label="Remove term"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {terms.length < 15 && <button type="button" onClick={() => setTerms(ts => [...ts, ''])} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add New Term</button>}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} disabled={!client.email} className="accent-gray-900" />Email invoice to client after creation{!client.email && <span className="text-xs font-normal text-gray-400">(isi email klien dulu)</span>}</label>
        </div>
      </div>

      <div className="flex justify-end">{actions}</div>
    </div>
  )
}
