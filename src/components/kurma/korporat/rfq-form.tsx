'use client'

// Borang "Minta sebut harga rasmi" (RFQ) LP korporat: sahkan klien → POST /api/kurma/rfq (disimpan
// ke gift_orders, e-mel admin) → kad kejayaan dgn no. rujukan → butang WhatsApp (openWaLead: Lead
// sekali sesesi + CAPI dedup). Cermin studio/enquiry-form (simpan dulu → WA). Pilihan calculator
// (jika ada) dilampir dari RfqProvider — bukan wajib: pegawai perolehan selalunya belum tahu gred kurma.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Send, MessageCircle, CheckCircle } from 'lucide-react'
import { HoneypotField } from '@/components/honeypot-field'
import { rm } from '@/lib/gift-pricing'
import { openWaLead, fireLead, getUtm } from '@/lib/kurma-track'
import { COMPANY } from '@/lib/company'
import { useRfqSelection } from './rfq-context'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const inp = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const lbl = 'block text-[12px] font-semibold text-gray-600 mb-1'

interface Result { order_number: string; est_qty: number; quote: { per_box: number; total: number; qty: number } | null; duplicate: boolean }

export function RfqForm() {
  const { sel } = useRfqSelection()
  const [form, setForm] = useState({ organisation: '', name: '', role: '', phone: '', email: '', est_qty: '', needed_by: '', notes: '' })
  const [website, setWebsite] = useState('')   // honeypot (JSON key `website`)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const doneRef = useRef(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const quote = sel && sel.quote.ok ? sel.quote : null
  // Kuantiti lalai ikut calculator (tier yang dipilih) bila pengguna belum taip sendiri
  const estQty = form.est_qty.trim() ? Number(form.est_qty) : (quote ? quote.qty : 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (doneRef.current || submitting) return
    if (form.organisation.trim().length < 2) { toast.error('Nama organisasi diperlukan'); return }
    if (form.name.trim().length < 2) { toast.error('Nama pegawai diperlukan'); return }
    if (form.phone.replace(/\D/g, '').length < 8) { toast.error('No. telefon tidak sah'); return }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) { toast.error('Email tidak sah'); return }
    if (!Number.isInteger(estQty) || estQty < 1) { toast.error('Anggaran kuantiti diperlukan'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/kurma/rfq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisation: form.organisation.trim(), name: form.name.trim(), role: form.role.trim(),
          phone: form.phone.trim(), email: form.email.trim(), est_qty: estQty,
          needed_by: form.needed_by || null, notes: form.notes.trim(), website,
          sel: sel ? { kurmaId: sel.kurmaId, weight: sel.weight, qty: sel.qty } : null,
          source_utm: getUtm().raw || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { toast.error(j.error ?? 'Gagal hantar — cuba lagi'); return }
      doneRef.current = true
      const r: Result = { order_number: j.order_number, est_qty: Number(j.est_qty ?? estQty), quote: j.quote ?? null, duplicate: !!j.duplicate }
      setResult(r)
      fireLead('korporat-rfq', 'korporat', r.quote?.total ?? 0)
      setTimeout(() => document.getElementById('rfq-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    } catch {
      toast.error('Gagal hantar — cuba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  function waText(r: Result): string {
    const lines: (string | null)[] = [
      'Salam Syabab Dates 👋', '',
      `Saya mewakili *${form.organisation.trim()}* — baru hantar permintaan sebut harga rasmi gift box kurma.`, '',
      `• Rujukan: *${r.order_number}*`,
      `• Pegawai: ${form.name.trim()}${form.role.trim() ? ` (${form.role.trim()})` : ''}`,
      `• Anggaran kuantiti: ${r.est_qty} kotak`,
      form.needed_by ? `• Perlu menjelang: ${form.needed_by}` : null,
      quote ? `• Pilihan awal: ${quote.kurma.name} · ${quote.weight} ≈ ${rm(quote.perBox)}/kotak` : null,
      form.notes.trim() ? `• Nota: ${form.notes.trim().slice(0, 200)}` : null,
      '', 'Mohon sebut harga rasmi & langkah seterusnya. Terima kasih.',
    ]
    return lines.filter((l): l is string => l !== null).join('\n')
  }

  if (result) {
    return (
      <div id="rfq-result" className="rounded-3xl border border-green-200 bg-green-50 p-5" role="status">
        <div className="flex items-center gap-2 text-green-800 font-black text-lg"><CheckCircle className="h-5 w-5" />Permintaan diterima{result.duplicate ? ' (sudah dihantar tadi)' : ''}</div>
        <p className="text-sm text-green-900/80 mt-1">No. rujukan: <span className="font-mono font-bold">{result.order_number}</span></p>
        <div className="mt-3 rounded-2xl bg-white border border-green-100 p-4 text-sm text-gray-700 space-y-1">
          <div><b className="text-gray-900">{form.organisation.trim()}</b> · {form.name.trim()}{form.role.trim() ? ` (${form.role.trim()})` : ''}</div>
          <div>Anggaran kuantiti: <b className="text-gray-900">{result.est_qty} kotak</b>{form.needed_by ? ` · perlu menjelang ${form.needed_by}` : ''}</div>
          {result.quote && quote && <div>Pilihan awal: {quote.kurma.name} · {quote.weight} · {rm(result.quote.per_box)}/kotak × {result.quote.qty} ≈ <b className="text-gray-900">{rm(result.quote.total)}</b> <span className="text-gray-400">(harga senarai, belum termasuk penghantaran)</span></div>}
        </div>
        <button type="button" onClick={() => openWaLead(waText(result), 'korporat', result.quote?.total ?? 0, 'korporat-rfq-wa')} className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-base active:scale-[0.99]" style={{ background: '#25D366' }}>
          <MessageCircle className="h-5 w-5" />Sahkan via WhatsApp
        </button>
        <p className="text-[11px] text-gray-500 text-center mt-2">Sebut harga rasmi dihantar dalam waktu pejabat ({COMPANY.hours}). Butiran & no. rujukan dihantar automatik.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-gray-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-5 space-y-4" noValidate>
      <div className="rounded-2xl bg-[#FBFAF7] border border-gray-100 px-4 py-3 text-[13px] text-gray-600">
        {quote
          ? <>Pilihan dari calculator: <b className="text-gray-900">{quote.kurma.name} · {quote.weight} · {quote.qty} kotak</b> ≈ <b className="text-gray-900">{rm(quote.total)}</b> — dilampir pada permintaan ini.</>
          : <>Belum pasti jenis kurma? Tak mengapa — isi kuantiti anggaran sahaja, kami cadangkan pilihan dalam sebut harga.</>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label htmlFor="rfq-org" className={lbl}>Organisasi / syarikat / agensi *</label><input id="rfq-org" value={form.organisation} onChange={set('organisation')} autoComplete="organization" className={inp} /></div>
        <div><label htmlFor="rfq-name" className={lbl}>Nama pegawai *</label><input id="rfq-name" value={form.name} onChange={set('name')} autoComplete="name" className={inp} /></div>
        <div><label htmlFor="rfq-role" className={lbl}>Jawatan / jabatan</label><input id="rfq-role" value={form.role} onChange={set('role')} autoComplete="organization-title" className={inp} /></div>
        <div><label htmlFor="rfq-phone" className={lbl}>No. telefon (WhatsApp) *</label><input id="rfq-phone" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="01x-xxx xxxx" className={inp} /></div>
        <div><label htmlFor="rfq-email" className={lbl}>Email rasmi</label><input id="rfq-email" value={form.email} onChange={set('email')} inputMode="email" autoComplete="email" className={inp} /></div>
        <div><label htmlFor="rfq-qty" className={lbl}>Anggaran kuantiti (kotak) *</label><input id="rfq-qty" value={form.est_qty} onChange={set('est_qty')} inputMode="numeric" placeholder={quote ? String(quote.qty) : 'cth 200'} className={inp} /></div>
        <div><label htmlFor="rfq-date" className={lbl}>Perlu menjelang</label><input id="rfq-date" type="date" value={form.needed_by} onChange={set('needed_by')} className={inp} /></div>
      </div>
      <div><label htmlFor="rfq-notes" className={lbl}>Nota (hantar ke mana, logo/jata, permintaan khas)</label><textarea id="rfq-notes" value={form.notes} onChange={set('notes')} rows={3} className={inp} /></div>
      <HoneypotField value={website} onChange={setWebsite} />
      <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-base active:scale-[0.99] disabled:opacity-50" style={{ background: '#E11D2A' }}>
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{submitting ? 'Menghantar…' : 'Hantar permintaan sebut harga'}
      </button>
      <p className="text-[11px] text-gray-400 text-center">Tiada bayaran sekarang. Sebut harga percuma — deposit {COMPANY.depositPct}% hanya selepas anda sahkan.</p>
    </form>
  )
}
