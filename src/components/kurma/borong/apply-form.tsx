'use client'

// Borang "Mohon harga borong": sahkan klien → POST /api/kurma/borong (customers + resellers pending + e-mel)
// → kad kejayaan dgn rujukan BRG-… → WhatsApp (openWaLead: Lead sekali sesesi + CAPI dedup).
// Jenis perniagaan pra-isi dari kad segmen; varieti pra-tanda dari butang "Pilih" katalog (BorongProvider).
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Send, MessageCircle, CheckCircle } from 'lucide-react'
import { HoneypotField } from '@/components/honeypot-field'
import { openWaLead, fireLead, getUtm } from '@/lib/kurma-track'
import { isValidMyMobile } from '@/lib/phone'
import { SEGMENT_IDS, SEGMENT_LABEL, MY_STATES, applyWaText, type SegmentId } from '@/lib/borong-copy'
import { COMPANY } from '@/lib/company'
import { useBorong } from './borong-context'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const inp = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const lbl = 'block text-[12px] font-semibold text-gray-600 mb-1'

interface Result { ref: string; duplicate: boolean; status: string }

export function ApplyForm({ varietyOptions }: { varietyOptions: string[] }) {
  const { segment, picks } = useBorong()
  const [form, setForm] = useState({ business_name: '', business_type: '' as SegmentId | '', name: '', phone: '', email: '', state: '', est_qty: '', est_unit: 'ctn' as 'kg' | 'ctn', notes: '' })
  const [varieties, setVarieties] = useState<string[]>([])
  const [website, setWebsite] = useState('')   // honeypot (JSON key `website`)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const doneRef = useRef(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  // Pra-isi dari kad segmen & butang "Pilih" katalog (hanya tambah, tak timpa pilihan pengguna)
  useEffect(() => { if (segment) setForm(f => ({ ...f, business_type: segment })) }, [segment])
  useEffect(() => { setVarieties(v => Array.from(new Set([...v, ...picks]))) }, [picks])

  const toggleVariety = (name: string) => setVarieties(v => (v.includes(name) ? v.filter(x => x !== name) : [...v, name]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (doneRef.current || submitting) return
    if (form.business_name.trim().length < 2) { toast.error('Nama perniagaan / organisasi diperlukan'); return }
    if (!form.business_type) { toast.error('Pilih jenis perniagaan'); return }
    if (form.name.trim().length < 2) { toast.error('Nama anda diperlukan'); return }
    if (!isValidMyMobile(form.phone)) { toast.error('Masukkan no. telefon bimbit Malaysia (01x)'); return }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) { toast.error('Email tidak sah'); return }
    const estQty = Number(form.est_qty)
    if (!Number.isInteger(estQty) || estQty < 1) { toast.error('Anggaran kuantiti sebulan diperlukan'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/kurma/borong', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: form.business_name.trim(), business_type: form.business_type, name: form.name.trim(), phone: form.phone.trim(),
          email: form.email.trim(), state: form.state || null, est_qty: estQty, est_unit: form.est_unit, varieties, notes: form.notes.trim(),
          website, source_utm: getUtm().raw || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { toast.error(j.error ?? 'Gagal hantar — cuba lagi'); return }
      doneRef.current = true
      setResult({ ref: j.ref, duplicate: !!j.duplicate, status: j.status ?? 'pending' })
      fireLead('borong-apply', 'borong', 0)
      setTimeout(() => document.getElementById('mohon-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    } catch {
      toast.error('Gagal hantar — cuba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    const estQty = Number(form.est_qty)
    const text = applyWaText({ business_name: form.business_name.trim(), business_type: form.business_type as SegmentId, name: form.name.trim(), est_qty: estQty, est_unit: form.est_unit, state: form.state || undefined, varieties, notes: form.notes.trim() || undefined }, result.ref)
    return (
      <div id="mohon-result" className="rounded-3xl border border-green-200 bg-green-50 p-5" role="status">
        <div className="flex items-center gap-2 text-green-800 font-black text-lg"><CheckCircle className="h-5 w-5" />Permohonan diterima{result.duplicate ? ' (dikemas kini)' : ''}</div>
        <p className="text-sm text-green-900/80 mt-1">No. rujukan: <span className="font-mono font-bold">{result.ref}</span></p>
        <div className="mt-3 rounded-2xl bg-white border border-green-100 p-4 text-sm text-gray-700 space-y-1">
          <div><b className="text-gray-900">{form.business_name.trim()}</b> · {SEGMENT_LABEL[form.business_type as SegmentId]}</div>
          <div>Anggaran: <b className="text-gray-900">{estQty} {form.est_unit === 'kg' ? 'kg' : 'karton'} sebulan</b>{form.state ? ` · ${form.state}` : ''}</div>
          {varieties.length > 0 && <div>Kurma: {varieties.join(', ')}</div>}
        </div>
        <button type="button" onClick={() => openWaLead(text, 'borong', 0, 'borong-apply-wa')} className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-base active:scale-[0.99]" style={{ background: '#25D366' }}>
          <MessageCircle className="h-5 w-5" />Dapatkan senarai harga via WhatsApp
        </button>
        <p className="text-[11px] text-gray-500 text-center mt-2">Kami balas dengan harga semasa dalam waktu pejabat ({COMPANY.hours}).</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-gray-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-5 space-y-4" noValidate>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label htmlFor="bg-biz" className={lbl}>Nama perniagaan / organisasi *</label><input id="bg-biz" value={form.business_name} onChange={set('business_name')} autoComplete="organization" className={inp} /></div>
        <div><label htmlFor="bg-type" className={lbl}>Jenis perniagaan *</label>
          <select id="bg-type" value={form.business_type} onChange={set('business_type')} className={inp}>
            <option value="">Pilih…</option>
            {SEGMENT_IDS.map(id => <option key={id} value={id}>{SEGMENT_LABEL[id]}</option>)}
          </select>
        </div>
        <div><label htmlFor="bg-state" className={lbl}>Negeri</label>
          <select id="bg-state" value={form.state} onChange={set('state')} className={inp}>
            <option value="">Pilih…</option>
            {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><label htmlFor="bg-name" className={lbl}>Nama anda *</label><input id="bg-name" value={form.name} onChange={set('name')} autoComplete="name" className={inp} /></div>
        <div><label htmlFor="bg-phone" className={lbl}>No. telefon (WhatsApp) *</label><input id="bg-phone" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="01x-xxx xxxx" className={inp} /></div>
        <div><label htmlFor="bg-email" className={lbl}>Email</label><input id="bg-email" value={form.email} onChange={set('email')} inputMode="email" autoComplete="email" className={inp} /></div>
        <div><label htmlFor="bg-qty" className={lbl}>Anggaran kuantiti sebulan *</label>
          <div className="flex gap-2">
            <input id="bg-qty" value={form.est_qty} onChange={set('est_qty')} inputMode="numeric" placeholder="cth 10" className={inp} />
            <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0" role="group" aria-label="Unit">
              {(['ctn', 'kg'] as const).map(u => <button key={u} type="button" aria-pressed={form.est_unit === u} onClick={() => setForm(f => ({ ...f, est_unit: u }))} className={`px-3 text-sm font-bold ${form.est_unit === u ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>{u === 'ctn' ? 'karton' : 'kg'}</button>)}
            </div>
          </div>
        </div>
      </div>
      {varietyOptions.length > 0 && (
        <div>
          <span className={lbl}>Kurma yang diminati</span>
          <div className="flex flex-wrap gap-1.5">
            {varietyOptions.map(v => <button key={v} type="button" aria-pressed={varieties.includes(v)} onClick={() => toggleVariety(v)} className={`text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border ${varieties.includes(v) ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>{v}</button>)}
          </div>
        </div>
      )}
      <div><label htmlFor="bg-notes" className={lbl}>Nota (lokasi hantar, gred, pek runcit, tarikh perlu)</label><textarea id="bg-notes" value={form.notes} onChange={set('notes')} rows={3} className={inp} /></div>
      <HoneypotField value={website} onChange={setWebsite} />
      <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-base active:scale-[0.99] disabled:opacity-50" style={{ background: '#E11D2A' }}>
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{submitting ? 'Menghantar…' : 'Hantar & dapatkan harga borong'}
      </button>
      <p className="text-[11px] text-gray-400 text-center">Tiada bayaran. Kami balas dengan senarai harga semasa & terma via WhatsApp.</p>
    </form>
  )
}
