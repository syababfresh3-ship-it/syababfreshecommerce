'use client'

// Editor sebut harga — susunan & label ikut borang "Create New Quotation" Refrens (pemilik 24 Okt:
// "tak pening kalau cross 2 sistem"). Fungsi: draf/keluarkan (nombor dari siri Refrens bila env ada),
// PDF, email, pautan klien, duplicate, batal, apply ke gift order, jadi invois Refrens, sejarah.
// Dikunci selepas diterima/dibatalkan/jadi invois (isEditable). Pengesahan dua-langkah inline.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, Plus, Trash2, X, ArrowUp, ArrowDown, Send, FileText, Link2, Copy, Ban, Mail, Search, Gift, Receipt, RefreshCw, ExternalLink, RotateCcw, Save } from 'lucide-react'
import { BANKS, DEFAULT_BANK_KEY, SELLER } from '@/lib/seller'
import { ItemNameInput } from '@/components/admin/item-name-input'
import { ringgitInWords } from '@/lib/number-words'
import {
  DEFAULT_NOTE, DEFAULT_TERMS, UNITS, VALID_DAYS, addDays, calcTotals, isEditable, rm, statusLabel,
  type Quotation, type QuotationClient, type QuotationEvent, type QuotationInvoiceRef, type QuotationItem,
} from '@/lib/quotation'

interface FormItem { name: string; description: string; showDesc: boolean; qty: string; unit: string; rate: string }
interface FormCharge { label: string; amount: string }
interface Form {
  client: QuotationClient; customer_id: string | null
  items: FormItem[]; discount: string; charges: FormCharge[]
  terms: string[]; notes: string; show_bank: boolean; bank_key: string
  custom_fields: { label: string; value: string }[]; valid_until: string; needed_by: string
  source_type: string | null; source_id: string | null
}
type Loaded = Quotation & { events?: QuotationEvent[]; expired?: boolean; invoice?: QuotationInvoiceRef | null; refrens_quotation?: QuotationInvoiceRef | null; refrens_configured?: boolean; deal?: { id: string; stage: string } | null }
interface CustomerHit { source?: 'web' | 'refrens'; id: string | null; refrens_id?: string | null; name: string | null; phone_norm: string | null; email: string | null; address: string | null; company?: string | null; company_reg_no?: string | null; tin?: string | null; billing_address?: string | null }

const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1'
const card = 'rounded-xl border border-gray-200 bg-white p-4'
const btnSm = 'h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-40'
const btnPrimary = 'inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50'
const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50'
const linkBtn = 'inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-40'
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', issued: 'bg-blue-50 text-blue-700', accepted: 'bg-green-50 text-green-700', rejected: 'bg-red-50 text-red-600',
  expired: 'bg-amber-50 text-amber-700', cancelled: 'bg-gray-100 text-gray-500', converted: 'bg-indigo-50 text-indigo-700',
}
const EVENT_LABEL: Record<string, string> = {
  created: 'Dicipta', issued: 'Dikeluarkan', edited: 'Diedit', emailed: 'Diemail', viewed: 'Dilihat klien', accepted: 'Diterima klien',
  rejected: 'Ditolak', cancelled: 'Dibatalkan', applied_gift_order: 'Dipakai ke gift order', duplicated: 'Diduplikat',
  converted: 'Jadi invois (Refrens)', invoice_synced: 'Status invois disegarkan', refrens_quotation: 'Sebut harga dicipta di Refrens', refrens_quotation_cancelled: 'Sebut harga Refrens dibatalkan',
}
const n2 = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmtDT = (v: string | null) => v ? new Date(v).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtD = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const emptyItem = (): FormItem => ({ name: '', description: '', showDesc: false, qty: '1', unit: 'pcs', rate: '0' })

function toForm(q: Partial<Quotation> | null | undefined): Form {
  return {
    client: q?.client ?? {}, customer_id: q?.customer_id ?? null,
    items: (q?.items?.length ? q.items : [{ name: '', description: null, qty: 1, unit: 'pcs', rate: 0 }]).map(i => ({ name: i.name, description: i.description ?? '', showDesc: !!i.description, qty: String(i.qty), unit: i.unit, rate: String(i.rate) })),
    discount: q?.discount ? String(q.discount) : '',
    charges: (q?.charges ?? []).map(c => ({ label: c.label, amount: String(c.amount) })),
    terms: q?.terms?.length ? [...q.terms] : [...DEFAULT_TERMS],
    notes: q?.notes ?? DEFAULT_NOTE,
    show_bank: q?.show_bank ?? true, bank_key: q?.bank_key ?? DEFAULT_BANK_KEY,
    custom_fields: q?.custom_fields ?? [],
    valid_until: q?.valid_until ?? addDays(new Date(), VALID_DAYS), needed_by: q?.needed_by ?? '',
    source_type: q?.source_type ?? null, source_id: q?.source_id ?? null,
  }
}
function toPayload(f: Form) {
  return {
    client: f.client, customer_id: f.customer_id,
    items: f.items.map(i => ({ name: i.name, description: i.showDesc ? i.description || null : null, qty: n2(i.qty), unit: i.unit || 'pcs', rate: n2(i.rate) })),
    discount: n2(f.discount), charges: f.charges.map(c => ({ label: c.label, amount: n2(c.amount) })),
    terms: f.terms, notes: f.notes, show_bank: f.show_bank, bank_key: f.bank_key, custom_fields: f.custom_fields,
    valid_until: f.valid_until || null, needed_by: f.needed_by || null, source_type: f.source_type, source_id: f.source_id,
  }
}

export function QuotationEditor({ id = null, giftOrderId = null }: { id?: string | null; giftOrderId?: string | null }) {
  const router = useRouter()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [search, setSearch] = useState('')
  const [clientMode, setClientMode] = useState<'select' | 'new'>('select')
  const [lastNo, setLastNo] = useState<string | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmInvoice, setConfirmInvoice] = useState(false)
  const [confirmIssue, setConfirmIssue] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (id) {
        const res = await fetch(`/api/admin/quotations/${id}`)
        const j = await res.json().catch(() => ({}))
        if (!res.ok) { toast.error(j.error ?? 'Tidak dijumpai'); setLoaded(null); setForm(null); return }
        setLoaded(j); setForm(toForm(j)); setEmailTo(j.client?.email ?? ''); setClientMode('new'); setShowNotes(!!j.notes)
      } else if (giftOrderId) {
        const res = await fetch(`/api/admin/quotations/prefill?gift_order=${giftOrderId}`)
        const j = await res.json().catch(() => ({}))
        if (!res.ok) toast.error(j.error ?? 'Gagal pra-isi dari gift order')
        setForm(toForm(res.ok ? j : null)); setClientMode(res.ok ? 'new' : 'select')
      } else {
        setForm(toForm(null)); setClientMode('select')
      }
    } finally { setLoading(false) }
  }, [id, giftOrderId])
  useEffect(() => { load() }, [load])

  // "Last No" dari siri sebut harga Refrens (baca sahaja; senyap jika Refrens tiada)
  useEffect(() => {
    fetch('/api/admin/refrens/invoices?type=QUOTATION&limit=1').then(r => r.ok ? r.json() : null)
      .then(j => { const d = j?.data?.[0]; if (d?.number) setLastNo(`${d.number}${d.date ? ` (${fmtD(d.date)})` : ''}`) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (search.trim().length < 2) { setHits([]); return }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/quotations/customers?q=${encodeURIComponent(search.trim())}`)
      const j = await res.json().catch(() => [])
      setHits(Array.isArray(j) ? j : [])
    }, 250)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const editable = !loaded || isEditable(loaded)
  const totals = useMemo(() => form ? calcTotals(
    form.items.map(i => ({ name: i.name, description: null, qty: n2(i.qty), unit: i.unit, rate: n2(i.rate) } as QuotationItem)),
    n2(form.discount), form.charges.map(c => ({ label: c.label, amount: n2(c.amount) })),
  ) : null, [form])

  const upd = (patch: Partial<Form>) => setForm(f => f ? { ...f, ...patch } : f)
  const updClient = (patch: Partial<QuotationClient>) => setForm(f => f ? { ...f, client: { ...f.client, ...patch } } : f)
  const updItem = (i: number, patch: Partial<FormItem>) => setForm(f => f ? { ...f, items: f.items.map((it, k) => k === i ? { ...it, ...patch } : it) } : f)
  const moveItem = (i: number, dir: -1 | 1) => setForm(f => {
    if (!f) return f
    const j = i + dir; if (j < 0 || j >= f.items.length) return f
    const items = [...f.items]; [items[i], items[j]] = [items[j], items[i]]; return { ...f, items }
  })
  function pickCustomer(c: CustomerHit) {
    updClient({ company: c.company ?? null, name: c.name ?? null, phone: c.phone_norm ? `+${c.phone_norm}` : null, email: c.email ?? null, address: c.billing_address ?? c.address ?? null, reg_no: c.company_reg_no ?? null, tin: c.tin ?? null })
    upd({ customer_id: c.id }); setSearch(''); setHits([]); setClientMode('new')
  }

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error ?? 'Gagal')
    return j
  }
  async function save(issue: boolean) {
    if (!form) return
    setBusy(issue ? 'issue' : 'save')
    try {
      if (!id) {
        const j = await api('/api/admin/quotations', { method: 'POST', body: JSON.stringify({ ...toPayload(form), issue }) })
        toast.success(issue ? `Dikeluarkan: ${j.quote_number}` : 'Draf disimpan')
        router.push(`/admin/quotations/${j.id}`)
        return
      }
      await api(`/api/admin/quotations/${id}`, { method: 'PATCH', body: JSON.stringify(toPayload(form)) })
      if (issue) { const j = await api(`/api/admin/quotations/${id}/issue`, { method: 'POST' }); toast.success(`Dikeluarkan: ${j.quote_number}`) }
      else toast.success('Disimpan')
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null); setConfirmIssue(false) }
  }
  async function act(key: string, path: string, body?: unknown, ok?: string) {
    setBusy(key)
    try {
      const j = await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
      if (ok) toast.success(ok)
      return j
    } catch (e) { toast.error((e as Error).message); return null } finally { setBusy(null) }
  }
  async function sendEmail() {
    const j = await act('email', `/api/admin/quotations/${id}/email`, { to: emailTo, message: emailMsg })
    if (j) { toast.success(`Email dihantar ke ${j.to}`); setEmailOpen(false); setEmailMsg(''); await load() }
  }
  async function cancelQ() {
    const j = await act('cancel', `/api/admin/quotations/${id}/cancel`, { reason: cancelReason }, 'Dibatalkan')
    if (j) { if (j.refrens === 'failed') toast.warning('Salinan di Refrens gagal dibatalkan — batalkan di Refrens'); setCancelOpen(false); await load() }
  }
  async function duplicate() {
    const j = await act('dup', `/api/admin/quotations/${id}/duplicate`, undefined, 'Salinan draf dibuat')
    if (j?.id) router.push(`/admin/quotations/${j.id}`)
  }
  async function applyToOrder() {
    const j = await act('apply', `/api/admin/quotations/${id}/apply`)
    if (j) { toast.success(`Order ${j.order_number}: total ${rm(j.total)}, deposit ${rm(j.deposit)}`); await load() }
  }
  async function makeInvoice() {
    const j = await act('invoice', `/api/admin/quotations/${id}/invoice`)
    if (j?.invoice) { toast.success(`Invois Refrens ${j.invoice.number} dicipta`); setConfirmInvoice(false); await load() }
  }
  async function refreshInvoice() {
    setBusy('invsync')
    try {
      const res = await fetch(`/api/admin/quotations/${id}/invoice`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal segarkan'); return }
      toast.success(`Status Refrens: ${j.invoice?.status ?? '—'}`); await load()
    } finally { setBusy(null) }
  }
  async function removeDraft() {
    setBusy('delete')
    try { await api(`/api/admin/quotations/${id}`, { method: 'DELETE' }); toast.success('Draf dipadam'); router.push('/admin/quotations') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  function copyLink() {
    if (!loaded?.share_token) return
    navigator.clipboard.writeText(`${location.origin}/q/${loaded.share_token}`).then(() => toast.success('Pautan klien disalin')).catch(() => toast.error('Gagal salin'))
  }

  if (loading || !form) return <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
  const status = loaded ? (loaded.expired ? 'expired' : loaded.status) : 'draft'
  const issued = !!loaded?.quote_number
  const c = form.client
  const bank = BANKS[(form.bank_key as keyof typeof BANKS)] ?? BANKS[DEFAULT_BANK_KEY]
  const canIssue = editable && !issued && !!(c.company || c.name) && form.items.some(i => i.name.trim() && n2(i.qty) > 0)
  const refrensOn = loaded ? loaded.refrens_configured !== false : true

  // Butang utama gaya Refrens: Save As Draft · Save & Continue (= keluarkan → nombor Refrens)
  const primaryActions = (
    <div className="flex flex-wrap items-center gap-2">
      {editable && <button type="button" onClick={() => save(false)} disabled={!!busy} className={btnGhost}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{issued ? 'Save' : 'Save As Draft'}</button>}
      {!issued && (confirmIssue
        ? <span className="inline-flex items-center gap-2 text-sm"><span className="text-gray-600">{refrensOn ? `Cipta sebut harga di Refrens (${rm(totals?.total ?? 0)}) & keluarkan?` : `Keluarkan (${rm(totals?.total ?? 0)})?`}</span><button type="button" onClick={() => save(true)} disabled={!!busy} className="font-bold text-gray-900 inline-flex items-center gap-1">{busy === 'issue' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Yes</button><button type="button" onClick={() => setConfirmIssue(false)} className="text-gray-500">No</button></span>
        : <button type="button" onClick={() => setConfirmIssue(true)} disabled={!canIssue || !!busy} className={btnPrimary}><Send className="h-4 w-4" />Save &amp; Continue</button>)}
    </div>
  )

  return (
    <div className="space-y-4">
      <Link href="/admin/quotations" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="h-4 w-4" />Quotations</Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {loaded?.quote_number ?? (id ? 'Draft Quotation' : 'Create New Quotation')}
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[status] ?? 'bg-gray-100 text-gray-600'}`}>{statusLabel(status === 'expired' ? 'expired' : status)}</span>
          </h1>
          <p className="text-sm text-gray-500">
            {loaded?.issued_at ? `Dikeluarkan ${fmtDT(loaded.issued_at)}${loaded?.refrens_quotation ? ' · nombor dari siri Refrens' : ''}` : (refrensOn ? 'Save & Continue → sebut harga dicipta di Refrens, nombor ikut siri Refrens.' : 'Nombor diberi bila dikeluarkan.')}
            {loaded?.accepted_at ? ` · Diterima ${fmtDT(loaded.accepted_at)} oleh ${loaded.accepted_by ?? '—'}` : ''}
            {loaded?.cancel_reason ? ` · Sebab batal: ${loaded.cancel_reason}` : ''}
          </p>
          <div className="flex flex-wrap gap-3 mt-1">
            {form.source_type === 'gift_order' && form.source_id && (
              <Link href={`/admin/kurma/${form.source_id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"><Gift className="h-3.5 w-3.5" />Berpaut pada gift order</Link>
            )}
            {loaded?.deal && (
              <Link href={`/admin/gift-pipeline?deal=${loaded.deal.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"><ExternalLink className="h-3.5 w-3.5" />Buka deal di Pipeline Gift</Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primaryActions}
          {id && <a href={`/api/admin/quotations/${id}/pdf`} target="_blank" rel="noreferrer" className={btnGhost}><FileText className="h-4 w-4" />PDF</a>}
          {issued && loaded?.status !== 'cancelled' && <button type="button" onClick={() => setEmailOpen(v => !v)} className={btnGhost}><Mail className="h-4 w-4" />Email</button>}
          {loaded?.share_token && <button type="button" onClick={copyLink} className={btnGhost}><Link2 className="h-4 w-4" />Share link</button>}
          {id && <button type="button" onClick={duplicate} disabled={!!busy} className={btnGhost}><Copy className="h-4 w-4" />Duplicate</button>}
          {issued && ['issued', 'accepted', 'expired'].includes(loaded?.status ?? '') && form.source_type === 'gift_order' && <button type="button" onClick={applyToOrder} disabled={!!busy} className={btnGhost}><Gift className="h-4 w-4" />Apply ke gift order</button>}
          {issued && ['issued', 'accepted'].includes(loaded?.status ?? '') && !loaded?.invoice && (confirmInvoice
            ? <span className="inline-flex items-center gap-1.5 text-sm"><span className="text-gray-600">Cipta invois sebenar di Refrens?</span><button type="button" onClick={makeInvoice} disabled={busy === 'invoice'} className="font-bold text-gray-900 inline-flex items-center gap-1">{busy === 'invoice' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Yes</button><button type="button" onClick={() => setConfirmInvoice(false)} className="text-gray-500">No</button></span>
            : <button type="button" onClick={() => setConfirmInvoice(true)} disabled={!!busy || !refrensOn} title={!refrensOn ? 'Refrens belum dikonfigurasi di pelayan ini' : 'Cipta invois di Refrens dari sebut harga ini'} className={btnPrimary}><Receipt className="h-4 w-4" />Convert to Invoice</button>)}
          {issued && ['issued', 'accepted', 'expired'].includes(loaded?.status ?? '') && <button type="button" onClick={() => setCancelOpen(v => !v)} className={btnGhost}><Ban className="h-4 w-4" />Cancel</button>}
          {id && loaded?.status === 'draft' && (confirmDelete
            ? <span className="inline-flex items-center gap-1 text-sm"><span className="text-gray-600">Padam draf?</span><button type="button" onClick={removeDraft} className="font-bold text-red-600">Ya</button><button type="button" onClick={() => setConfirmDelete(false)} className="text-gray-500">Tidak</button></span>
            : <button type="button" onClick={() => setConfirmDelete(true)} className={btnGhost}><Trash2 className="h-4 w-4" />Delete</button>)}
        </div>
      </div>

      {/* Pautan & salinan Refrens & invois */}
      {loaded?.share_token && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 flex flex-wrap items-center gap-2">
          <Link2 className="h-3.5 w-3.5" /><span>Pautan klien (lihat, PDF, Accept):</span>
          <a href={`/q/${loaded.share_token}`} target="_blank" rel="noreferrer" className="font-mono text-gray-900 hover:underline break-all">/q/{loaded.share_token}</a>
        </div>
      )}
      {loaded?.refrens_quotation && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-gray-700">Salinan di Refrens:</span>
          <span className="font-mono text-gray-900">{loaded.refrens_quotation.number}</span>
          {loaded.refrens_quotation.pdf && <a href={loaded.refrens_quotation.pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900"><FileText className="h-3.5 w-3.5" />PDF Refrens</a>}
          {loaded.refrens_quotation.link && <a href={loaded.refrens_quotation.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900"><ExternalLink className="h-3.5 w-3.5" />Pautan Refrens</a>}
          <span className="text-gray-400">Terima/tolak direkod di website; Refrens tak dikemas kini automatik.</span>
        </div>
      )}
      {loaded?.invoice && (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Invois Refrens</p>
            <button type="button" onClick={refreshInvoice} disabled={busy === 'invsync'} className={linkBtn}>{busy === 'invsync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Segarkan status</button>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-sm">
            <span className="font-bold text-gray-900">{loaded.invoice.number}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${loaded.invoice.status === 'PAID' ? 'bg-green-50 text-green-700' : loaded.invoice.status === 'CANCELED' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>{loaded.invoice.status}</span>
            {loaded.invoice.total !== null && <span className="font-mono text-gray-900">{rm(loaded.invoice.total)}</span>}
            {loaded.invoice.pdf && <a href={loaded.invoice.pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"><FileText className="h-3.5 w-3.5" />PDF</a>}
            {loaded.invoice.link && <a href={loaded.invoice.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"><ExternalLink className="h-3.5 w-3.5" />Pautan klien</a>}
            <span className="text-xs text-gray-400">Disegarkan {fmtDT(loaded.invoice.synced_at)}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Bayaran, e-Invois LHDN dan perakaunan diurus dalam Refrens. Status ditarik bila Segarkan ditekan.</p>
        </div>
      )}
      {emailOpen && (
        <div className={card}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Email sebut harga ke klien</p>
          <div className="grid sm:grid-cols-[1fr_2fr] gap-3">
            <div><label className={lbl}>Kepada</label><input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} className={inp} placeholder="email@klien.com" /></div>
            <div><label className={lbl}>Mesej tambahan (pilihan)</label><textarea value={emailMsg} onChange={e => setEmailMsg(e.target.value)} rows={2} className={inp} /></div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button type="button" onClick={sendEmail} disabled={busy === 'email' || !emailTo} className={btnPrimary}>{busy === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Hantar email</button>
            <button type="button" onClick={() => setEmailOpen(false)} className={btnGhost}>Tutup</button>
            <span className="text-xs text-gray-400">PDF dilampirkan + pautan lihat & terima.</span>
          </div>
        </div>
      )}
      {cancelOpen && (
        <div className={card}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Batalkan sebut harga</p>
          <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} className={inp} placeholder="Sebab (pilihan)" />
          <div className="flex items-center gap-2 mt-3">
            <button type="button" onClick={cancelQ} disabled={busy === 'cancel'} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50">{busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}Sahkan batal</button>
            <button type="button" onClick={() => setCancelOpen(false)} className={btnGhost}>Tutup</button>
            {loaded?.refrens_quotation && <span className="text-xs text-gray-400">Salinan di Refrens turut dibatalkan.</span>}
          </div>
        </div>
      )}

      {/* ── Borang gaya Refrens ── */}
      <div className={card}>
        <p className="text-2xl font-bold text-gray-900 text-center">Quotation</p>

        <div className="grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center max-w-xl mt-5">
          <label className="text-sm font-semibold text-gray-700">Quotation No*</label>
          <div><input value={loaded?.quote_number ?? ''} disabled placeholder={refrensOn ? 'Auto (siri Refrens, bila Save & Continue)' : 'Auto (bila dikeluarkan)'} className={`${inp} max-w-xs font-mono`} />{lastNo && !issued && <p className="text-[11px] text-gray-400 mt-1">Last No: {lastNo}</p>}</div>
          <label className="text-sm font-semibold text-gray-700">Quotation Date*</label>
          <input value={fmtD(loaded?.issued_at ?? new Date().toISOString())} disabled className={`${inp} max-w-xs`} />
          <label className="text-sm font-semibold text-gray-700">Valid until</label>
          <input type="date" value={form.valid_until} onChange={e => upd({ valid_until: e.target.value })} disabled={!editable} className={`${inp} max-w-xs`} />
          <label className="text-sm font-semibold text-gray-700">Tarikh perlu hantar</label>
          <div><input type="date" value={form.needed_by} onChange={e => upd({ needed_by: e.target.value })} disabled={!editable} className={`${inp} max-w-xs`} /><p className="text-[11px] text-gray-400 mt-1">Bila klien perlu barang. Dicetak &quot;Required delivery&quot; pada PDF; memacu peringatan di Pipeline Gift. Lead time cetak ~2 minggu.</p></div>
        </div>

        <div className="mt-3 space-y-2">
          {form.custom_fields.map((f, i) => (
            <div key={i} className="flex gap-2 max-w-xl">
              <input value={f.label} onChange={e => upd({ custom_fields: form.custom_fields.map((x, k) => k === i ? { ...x, label: e.target.value } : x) })} disabled={!editable} placeholder="Field name" className={`${inp} w-44`} />
              <input value={f.value} onChange={e => upd({ custom_fields: form.custom_fields.map((x, k) => k === i ? { ...x, value: e.target.value } : x) })} disabled={!editable} placeholder="Value" className={inp} />
              {editable && <button type="button" onClick={() => upd({ custom_fields: form.custom_fields.filter((_, k) => k !== i) })} className={btnSm} aria-label="Buang medan"><X className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
          {editable && form.custom_fields.length < 10 && <button type="button" onClick={() => upd({ custom_fields: [...form.custom_fields, { label: '', value: '' }] })} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add Custom Fields</button>}
        </div>

        {/* Quotation From / For */}
        <div className="grid lg:grid-cols-2 gap-4 mt-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="font-bold text-gray-900">Quotation From <span className="text-xs font-normal text-gray-500">(Your Details)</span></p>
            <p className="text-sm font-semibold text-gray-900 mt-2">{SELLER.name.toUpperCase()} ({SELLER.regOld})</p>
            <p className="text-sm text-gray-600">{SELLER.addr1} {SELLER.addr2}</p>
            <p className="text-sm text-gray-600 mt-1">Email {SELLER.email}<br />Phone {SELLER.phoneSales}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-gray-900">Quotation For <span className="text-xs font-normal text-gray-500">(Client&apos;s Details)</span></p>
              {editable && clientMode === 'new' && <button type="button" onClick={() => { upd({ client: {}, customer_id: null }); setClientMode('select') }} className={linkBtn}><X className="h-3.5 w-3.5" />Change client</button>}
            </div>
            {editable && clientMode === 'select' ? (
              <div className="mt-3">
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Select a Client (cari nama / syarikat / telefon)" className={`${inp} pl-8`} />
                  {hits.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg text-sm">
                      {hits.map(h => <li key={h.id}><button type="button" onClick={() => pickCustomer(h)} className="w-full text-left px-3 py-2 hover:bg-gray-50"><span className="font-semibold text-gray-900">{h.company || h.name || '—'}</span><span className="block text-xs text-gray-500">{h.source === 'refrens' && <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-gray-900 text-white px-1 py-px rounded mr-1.5 align-middle">Refrens</span>}{[h.company ? h.name : null, h.phone_norm, h.email].filter(Boolean).join(' · ')}</span></button></li>)}
                    </ul>
                  )}
                </div>
                <p className="text-center text-xs text-gray-400 my-3">OR</p>
                <button type="button" onClick={() => setClientMode('new')} className={`${btnPrimary} w-full justify-center`}><Plus className="h-4 w-4" />Add New Client</button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div><label className={lbl}>Business / Client name*</label><input value={c.company ?? ''} onChange={e => updClient({ company: e.target.value })} disabled={!editable} className={inp} /></div>
                <div><label className={lbl}>Contact person</label><input value={c.name ?? ''} onChange={e => updClient({ name: e.target.value })} disabled={!editable} className={inp} /></div>
                <div><label className={lbl}>Email</label><input type="email" value={c.email ?? ''} onChange={e => updClient({ email: e.target.value })} disabled={!editable} className={inp} /></div>
                <div><label className={lbl}>Phone</label><input value={c.phone ?? ''} onChange={e => updClient({ phone: e.target.value })} disabled={!editable} className={inp} /></div>
                <div><label className={lbl}>Registration No. (SSM)</label><input value={c.reg_no ?? ''} onChange={e => updClient({ reg_no: e.target.value })} disabled={!editable} className={inp} placeholder="Pilihan — perlu untuk e-Invois" /></div>
                <div><label className={lbl}>TIN</label><input value={c.tin ?? ''} onChange={e => updClient({ tin: e.target.value })} disabled={!editable} className={inp} placeholder="Pilihan" /></div>
                <div className="sm:col-span-2"><label className={lbl}>Address</label><textarea value={c.address ?? ''} onChange={e => updClient({ address: e.target.value })} disabled={!editable} rows={2} className={inp} /></div>
                {editable && <p className="sm:col-span-2 text-[11px] text-gray-400">Klien baharu dicipta automatik di Refrens (ikut email/telefon) bila Save &amp; Continue.</p>}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5 text-sm">
          <span className="font-semibold text-gray-700">Currency*</span>
          <span className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-600">Malaysian Ringgit (MYR, RM)</span>
        </div>

        {/* Jadual item */}
        <div className="mt-4 rounded-lg border border-gray-200">{/* tiada overflow-hidden — dropdown cadangan item perlu melimpah */}
          <div className="hidden md:grid grid-cols-[1fr_80px_90px_90px_120px_130px_96px] gap-2 bg-gray-900 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-2 rounded-t-lg"><span>Item</span><span>Code</span><span className="text-right">Quantity</span><span>Unit</span><span className="text-right">Rate</span><span className="text-right">Amount</span><span /></div>
          <datalist id="quotation-units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
          <div className="divide-y divide-gray-100">
            {form.items.map((it, i) => (
              <div key={i} className="grid md:grid-cols-[1fr_80px_90px_90px_120px_130px_96px] gap-2 items-start p-2">
                <div className="space-y-1">
                  <ItemNameInput value={it.name} onChange={v => updItem(i, { name: v })} onPick={h => updItem(i, { name: h.name, rate: h.rate > 0 ? String(h.rate) : it.rate, unit: h.unit || it.unit, description: it.description || (h.description ?? ''), showDesc: it.showDesc || !!h.description })} disabled={!editable} placeholder={`${i + 1}. Item Name (taip untuk cadangan katalog)`} className={`${inp} font-semibold`} />
                  {it.showDesc ? <textarea value={it.description} onChange={e => updItem(i, { description: e.target.value })} disabled={!editable} placeholder="Description" rows={2} className={`${inp} text-xs`} /> : (editable && <button type="button" onClick={() => updItem(i, { showDesc: true })} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add Description</button>)}
                </div>
                <input value="" disabled placeholder="—" title="Kod item tidak disokong" className={`${inp} hidden md:block`} aria-label="Code" />
                <div className="grid grid-cols-3 gap-2 md:contents">
                  <input type="number" min="0" step="any" value={it.qty} onChange={e => updItem(i, { qty: e.target.value })} disabled={!editable} placeholder="Qty" className={`${inp} text-right font-mono`} aria-label="Quantity" />
                  <input list="quotation-units" value={it.unit} onChange={e => updItem(i, { unit: e.target.value })} disabled={!editable} placeholder="Unit" className={inp} aria-label="Unit" />
                  <input type="number" min="0" step="0.01" value={it.rate} onChange={e => updItem(i, { rate: e.target.value })} disabled={!editable} placeholder="Rate" className={`${inp} text-right font-mono`} aria-label="Rate" />
                </div>
                <div className="flex items-center justify-between gap-2 md:contents">
                  <div className="text-sm font-bold text-gray-900 text-right py-1.5 font-mono"><span className="md:hidden text-[11px] font-semibold text-gray-400 mr-2">Amount</span>{rm(n2(it.qty) * n2(it.rate))}</div>
                  <div className="flex items-center justify-end gap-1">
                    {editable && <>
                      <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className={btnSm} aria-label="Naik"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveItem(i, 1)} disabled={i === form.items.length - 1} className={btnSm} aria-label="Turun"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => upd({ items: form.items.filter((_, k) => k !== i) })} disabled={form.items.length === 1} className={btnSm} aria-label="Buang baris"><Trash2 className="h-3.5 w-3.5" /></button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {editable && <button type="button" onClick={() => upd({ items: [...form.items, emptyItem()] })} className="mt-2 w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm font-semibold text-gray-600 hover:border-gray-500 inline-flex items-center justify-center gap-1"><Plus className="h-4 w-4" />Add New Line</button>}

        {/* Bank (kiri) + jumlah (kanan) */}
        <div className="grid lg:grid-cols-2 gap-4 mt-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-sm font-semibold text-gray-800">Show Bank Account Details</span>
              <input type="checkbox" checked={form.show_bank} onChange={e => upd({ show_bank: e.target.checked })} disabled={!editable} className="accent-gray-900 h-4 w-4" />
            </label>
            <p className="text-sm font-semibold text-gray-900 mt-2">{bank.accName}</p>
            <p className="text-sm text-gray-600">Bank: {bank.name} · Acc. No: {bank.accNo}</p>
            <select value={form.bank_key} onChange={e => upd({ bank_key: e.target.value })} disabled={!editable || !form.show_bank} className={`${inp} mt-2 w-auto`}>
              {Object.entries(BANKS).map(([k, b]) => <option key={k} value={k}>Select Another Bank Account: {b.name} · {b.accNo}</option>)}
            </select>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="space-y-2">
              {(form.discount !== '' || !editable) ? (
                <div className="flex items-center gap-2"><label className="text-sm text-gray-700 w-40">Discount (RM)</label><input type="number" min="0" step="0.01" value={form.discount} onChange={e => upd({ discount: e.target.value })} disabled={!editable} className={`${inp} w-36 font-mono text-right`} />{editable && <button type="button" onClick={() => upd({ discount: '' })} className={btnSm} aria-label="Buang diskaun"><X className="h-3.5 w-3.5" /></button>}</div>
              ) : <button type="button" onClick={() => upd({ discount: '0' })} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add Discounts</button>}
              {form.charges.map((ch, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={ch.label} onChange={e => upd({ charges: form.charges.map((x, k) => k === i ? { ...x, label: e.target.value } : x) })} disabled={!editable} placeholder="Charge name" className={`${inp} w-40`} />
                  <input type="number" min="0" step="0.01" value={ch.amount} onChange={e => upd({ charges: form.charges.map((x, k) => k === i ? { ...x, amount: e.target.value } : x) })} disabled={!editable} className={`${inp} w-36 font-mono text-right`} />
                  {editable && <button type="button" onClick={() => upd({ charges: form.charges.filter((_, k) => k !== i) })} className={btnSm} aria-label="Buang caj"><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              {editable && form.charges.length < 10 && <button type="button" onClick={() => upd({ charges: [...form.charges, { label: '', amount: '0' }] })} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add Additional Charges</button>}
            </div>
            {totals && (
              <>
                <dl className="text-sm mt-4 space-y-1">
                  {(totals.discount > 0 || totals.chargesTotal > 0) && <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd className="font-mono">{rm(totals.subtotal)}</dd></div>}
                  {totals.discount > 0 && <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd className="font-mono text-green-700">- {rm(totals.discount)}</dd></div>}
                  {totals.chargesTotal > 0 && <div className="flex justify-between"><dt className="text-gray-500">Additional charges</dt><dd className="font-mono">{rm(totals.chargesTotal)}</dd></div>}
                  <div className="flex justify-between border-t-2 border-gray-900 pt-2 mt-1"><dt className="font-bold text-gray-900">Total (MYR)</dt><dd className="font-black text-lg font-mono">{rm(totals.total)}</dd></div>
                </dl>
                <p className="text-xs text-gray-500 mt-3"><span className="font-semibold text-gray-700">Total (in words)</span><br />{ringgitInWords(totals.total)}</p>
              </>
            )}
          </div>
        </div>

        {/* Tandatangan / cop */}
        <div className="flex justify-end mt-5">
          <div className="text-center">
            <div className="h-16 w-16 mx-auto rounded-full border-2 border-dashed border-gray-300 grid place-items-center text-[10px] font-bold text-gray-400">COP</div>
            <p className="text-[11px] text-gray-500 mt-1">This is computer generated no signature required</p>
            <p className="text-[11px] text-gray-400">Cop dicetak pada PDF bila fail cop ada.</p>
          </div>
        </div>

        {/* Nota + terma */}
        <div className="mt-5 space-y-4">
          {showNotes ? <div><div className="flex items-center justify-between"><label className={lbl}>Notes</label>{editable && <button type="button" onClick={() => { setShowNotes(false); upd({ notes: '' }) }} className={linkBtn}><X className="h-3.5 w-3.5" />Remove</button>}</div><textarea value={form.notes} onChange={e => upd({ notes: e.target.value })} disabled={!editable} rows={2} className={inp} /></div>
            : (editable && <button type="button" onClick={() => { setShowNotes(true); upd({ notes: DEFAULT_NOTE }) }} className={btnGhost}><Plus className="h-4 w-4" />Add Notes</button>)}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900">Terms and Conditions</p>
              {editable && <button type="button" onClick={() => upd({ terms: [...DEFAULT_TERMS] })} className={linkBtn}><RotateCcw className="h-3.5 w-3.5" />Set lalai</button>}
            </div>
            <div className="space-y-2">
              {form.terms.map((t, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-xs text-gray-400 pt-2 w-5">{String(i + 1).padStart(2, '0')}</span>
                  <textarea value={t} onChange={e => upd({ terms: form.terms.map((x, k) => k === i ? e.target.value : x) })} disabled={!editable} rows={2} className={inp} />
                  {editable && <button type="button" onClick={() => upd({ terms: form.terms.filter((_, k) => k !== i) })} className={btnSm} aria-label="Buang terma"><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              {editable && form.terms.length < 15 && <button type="button" onClick={() => upd({ terms: [...form.terms, ''] })} className={linkBtn}><Plus className="h-3.5 w-3.5" />Add New Term</button>}
            </div>
          </div>
        </div>
      </div>

      {editable ? <div className="flex justify-end">{primaryActions}</div>
        : <p className="text-xs text-gray-500">Sebut harga ini dikunci. Guna Duplicate untuk versi baharu.</p>}

      {loaded?.events && loaded.events.length > 0 && (
        <div className={card}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Sejarah</p>
          <ul className="text-sm space-y-1.5">
            {loaded.events.map(ev => (
              <li key={ev.id} className="flex flex-wrap gap-x-3 text-gray-700">
                <span className="text-gray-400 w-36 shrink-0">{fmtDT(ev.created_at)}</span>
                <span className="font-semibold">{EVENT_LABEL[ev.type] ?? ev.type}</span>
                <span className="text-gray-500 text-xs">{ev.actor ?? ''}{ev.meta && Object.keys(ev.meta).length ? ` · ${Object.entries(ev.meta).map(([k, v]) => `${k}: ${typeof v === 'object' && v ? ((v as { number?: string }).number ?? JSON.stringify(v).slice(0, 40)) : Array.isArray(v) ? v.join(',') : String(v)}`).join(' · ')}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
