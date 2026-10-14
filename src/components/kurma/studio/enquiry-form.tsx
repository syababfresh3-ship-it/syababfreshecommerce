'use client'

// Borang enquiry studio: sahkan klien → (template+logo) gubah mockup → upload → POST /api/kurma/enquiry
// (disimpan ke admin, harga dikira semula server) → kad kejayaan dgn no. rujukan → butang WhatsApp
// (openWaLead: Lead sekali sesesi + CAPI dedup). Corak: lp-inline-checkout (simpan dulu → WA).
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Send, MessageCircle, CheckCircle } from 'lucide-react'
import { HoneypotField } from '@/components/honeypot-field'
import type { GiftCalculatorSelection } from '@/components/kurma/gift-calculator'
import { finishLabel, type GiftDesign, type GiftFinishCode } from '@/lib/gift'
import { rm } from '@/lib/gift-pricing'
import { composeMockup, normalizeLogoArea, type LogoTransform } from '@/lib/gift-mockup'
import { openWaLead, fireLead, getUtm } from '@/lib/kurma-track'
import type { LogoAsset } from './logo-uploader'
import type { DesignAsset } from './full-design-upload'
import type { DesignMode } from './gift-studio'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const inp = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const lbl = 'block text-[12px] font-semibold text-gray-600 mb-1'

interface Result { order_number: string; total: number; per_box: number; qty: number; mockup_url: string | null; mockupFailed: boolean; duplicate: boolean }

export function EnquiryForm({ sel, mode, template, logo, t, fullDesign, finishing }: {
  sel: GiftCalculatorSelection | null
  mode: DesignMode
  template: GiftDesign | null
  logo: LogoAsset | null
  t: LogoTransform
  fullDesign: DesignAsset | null
  finishing: GiftFinishCode
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', notes: '' })
  const [website, setWebsite] = useState('')   // honeypot (JSON key `website`)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const doneRef = useRef(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (doneRef.current || submitting) return
    if (form.name.trim().length < 2) { toast.error('Nama diperlukan'); return }
    if (form.phone.replace(/\D/g, '').length < 8) { toast.error('No. telefon tidak sah'); return }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) { toast.error('Email tidak sah'); return }
    if (!sel || !sel.quote.ok) { toast.error('Sila pilih pilihan harga di atas dulu'); return }
    setSubmitting(true)
    try {
      // Mockup (template + logo) — gagal/tercemar → teruskan dgn logo sahaja
      let mockupUrl: string | null = null
      let mockupFailed = false
      if (mode === 'template' && template?.image_url && logo) {
        const blob = await composeMockup({ templateUrl: template.image_url, logoSrc: logo.blobUrl, area: normalizeLogoArea(template.logo_area), t })
        if (blob) {
          const fd = new FormData(); fd.append('file', new File([blob], 'mockup.webp', { type: 'image/webp' })); fd.append('kind', 'mockup')
          const r = await fetch('/api/kurma/upload', { method: 'POST', body: fd }).catch(() => null)
          const j = r ? await r.json().catch(() => ({})) : {}
          if (r?.ok && j.url) mockupUrl = j.url; else mockupFailed = true
        } else mockupFailed = true
      }

      const res = await fetch('/api/kurma/enquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), company: form.company.trim(), notes: form.notes.trim(),
          website,
          kurmaId: sel.kurmaId, weight: sel.weight, qty: sel.qty, finishing,
          template_id: mode === 'template' ? (template?.id ?? null) : null,
          logo_url: mode === 'template' ? (logo?.url ?? null) : null,
          mockup_url: mockupUrl,
          full_design_url: mode === 'full' ? (fullDesign?.url ?? null) : null,
          logo_transform: mode === 'template' && logo ? t : null,
          source_utm: getUtm().raw || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { toast.error(j.error ?? 'Gagal hantar — cuba lagi'); return }
      doneRef.current = true
      setResult({
        order_number: j.order_number, total: Number(j.total ?? sel.quote.total), per_box: Number(j.per_box ?? sel.quote.perBox),
        qty: Number(j.qty ?? sel.quote.qty), mockup_url: mockupUrl, mockupFailed, duplicate: !!j.duplicate,
      })
      fireLead('studio-enquiry', undefined, Number(j.total ?? sel.quote.total))
      setTimeout(() => document.getElementById('enquiry-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    } catch {
      toast.error('Gagal hantar — cuba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  function waText(r: Result): string {
    const q = sel && sel.quote.ok ? sel.quote : null
    const asset = r.mockup_url ? ['Mockup', r.mockup_url] : mode === 'full' && fullDesign ? ['Design', fullDesign.url] : logo ? ['Logo', logo.url] : null
    const lines: (string | null)[] = [
      'Salam Syabab Dates 👋', '',
      'Saya baru hantar enquiry *Custom Gift Box Kurma* di Studio:', '',
      `• Rujukan: *${r.order_number}*`,
      `• Nama / syarikat: ${form.name.trim()}${form.company.trim() ? ` — ${form.company.trim()}` : ''}`,
      q ? `• Kurma: ${q.kurma.name} · ${q.weight} · ${r.qty} kotak · ${finishLabel(finishing)}` : null,
      mode === 'template' && template ? `• Template: ${template.name}` : null,
      `• Anggaran: ${rm(r.per_box)}/kotak = *${rm(r.total)}* (belum termasuk penghantaran)`,
      asset ? `• ${asset[0]}: ${asset[1]}` : null,
      form.notes.trim() ? `• Nota: ${form.notes.trim().slice(0, 200)}` : null,
      '', 'Tolong sahkan harga & langkah seterusnya. Terima kasih!',
    ]
    return lines.filter((l): l is string => l !== null).join('\n')
  }

  if (result) {
    const label = sel ? `studio-${sel.kurmaId}-${sel.weight}` : 'studio-enquiry'
    return (
      <div id="enquiry-result" className="rounded-3xl border border-green-200 bg-green-50 p-5" role="status">
        <div className="flex items-center gap-2 text-green-800 font-black text-lg"><CheckCircle className="h-5 w-5" />Enquiry diterima{result.duplicate ? ' (sudah dihantar tadi)' : ''}</div>
        <p className="text-sm text-green-900/80 mt-1">No. rujukan anda: <span className="font-mono font-bold">{result.order_number}</span></p>
        <div className="mt-3 rounded-2xl bg-white border border-green-100 p-4 text-sm text-gray-700 space-y-1">
          {sel && sel.quote.ok && <div>{sel.quote.kurma.name} · {sel.weight} · <b>{result.qty} kotak</b> · {finishLabel(finishing)}</div>}
          <div>{rm(result.per_box)}/kotak × {result.qty} = <b className="text-gray-900">{rm(result.total)}</b> <span className="text-gray-400">(belum termasuk penghantaran)</span></div>
          {(result.mockup_url || (mode === 'template' && logo) || (mode === 'full' && fullDesign?.previewUrl)) && (
            <div className="pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.mockup_url ?? (mode === 'template' ? logo?.blobUrl : fullDesign?.previewUrl) ?? ''} alt="Design anda" className="h-28 rounded-lg border border-gray-100 object-contain bg-[#FBFAF7]" />
              {result.mockupFailed && <p className="text-[11px] text-gray-400 mt-1">Mockup tidak dapat dijana di pelayar ini — logo anda tetap dihantar.</p>}
            </div>
          )}
        </div>
        <button type="button" onClick={() => openWaLead(waText(result), undefined, result.total, label)} className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-base active:scale-[0.99]" style={{ background: '#25D366' }}>
          <MessageCircle className="h-5 w-5" />Sahkan via WhatsApp
        </button>
        <p className="text-[11px] text-gray-500 text-center mt-2">Butiran & no. rujukan dihantar automatik — kami balas secepat mungkin dalam waktu pejabat.</p>
      </div>
    )
  }

  const ready = !!sel && sel.quote.ok
  return (
    <form onSubmit={submit} className="rounded-3xl border border-gray-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-5 space-y-4" noValidate>
      <div className="rounded-2xl bg-[#FBFAF7] border border-gray-100 px-4 py-3 text-[13px] text-gray-600">
        {ready && sel.quote.ok
          ? <>Pilihan: <b className="text-gray-900">{sel.quote.kurma.name} · {sel.weight} · {sel.quote.qty} kotak</b> · {finishLabel(finishing)} → anggaran <b className="text-gray-900">{rm(sel.quote.total)}</b>{mode === 'template' ? (template ? ` · template ${template.name}` : '') : fullDesign ? ' · design penuh dilampir' : ''}{mode === 'template' && logo ? ' · logo dilampir' : ''}</>
          : <>Pilih kurma, berat & kuantiti di bahagian <a href="#kira" className="underline underline-offset-2 font-semibold">Kira harga</a> dulu.</>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label htmlFor="eq-name" className={lbl}>Nama *</label><input id="eq-name" value={form.name} onChange={set('name')} autoComplete="name" className={inp} /></div>
        <div><label htmlFor="eq-phone" className={lbl}>No. telefon (WhatsApp) *</label><input id="eq-phone" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="01x-xxx xxxx" className={inp} /></div>
        <div><label htmlFor="eq-email" className={lbl}>Email</label><input id="eq-email" value={form.email} onChange={set('email')} inputMode="email" autoComplete="email" className={inp} /></div>
        <div><label htmlFor="eq-company" className={lbl}>Syarikat / agensi</label><input id="eq-company" value={form.company} onChange={set('company')} autoComplete="organization" className={inp} /></div>
      </div>
      <div><label htmlFor="eq-notes" className={lbl}>Nota (tarikh perlu, hantar ke mana, permintaan khas)</label><textarea id="eq-notes" value={form.notes} onChange={set('notes')} rows={3} className={inp} /></div>
      <HoneypotField value={website} onChange={setWebsite} />
      <button type="submit" disabled={submitting || !ready} className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white font-bold text-base active:scale-[0.99] disabled:opacity-50" style={{ background: '#E11D2A' }}>
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{submitting ? 'Menghantar…' : 'Hantar enquiry & teruskan ke WhatsApp'}
      </button>
      <p className="text-[11px] text-gray-400 text-center">Tiada bayaran sekarang. Kami sahkan harga & design dulu, deposit hanya selepas anda setuju.</p>
    </form>
  )
}
