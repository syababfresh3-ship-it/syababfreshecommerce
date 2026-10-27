'use client'

// Dialog hantar sebut harga / invois ke klien — team sales pilih saluran setiap kali:
//   WhatsApp Official (perbualan inbox, PDF dilampirkan) · Template Meta (tetingkap 24j tutup) ·
//   Buka WhatsApp sendiri (wa.me, akaun lama sales) · Email. API: /api/admin/quotations/[id]/send. Ikon lucide monokrom.
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, X, Send, Mail, MessageCircle, ExternalLink, FileText } from 'lucide-react'

export type DocKind = 'quotation' | 'invoice'
export type SendChannel = 'official' | 'template' | 'unofficial' | 'email'

interface Prefill {
  doc: DocKind; number: string; total: number | null; phone: string; waId: string | null; email: string; clientName: string
  message: string; link: string | null; pdfUrl: string | null; waMeUrl: string | null
  conversation: { conversationId: string; numberName: string | null; lastInboundAt: string | null; windowOpen: boolean } | null
  templates: { name: string; language: string; headerType: string; bodyParams: number }[]
  templatesError: string | null
  defaultTemplate: { name: string; language: string } | null
}

const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-gray-900'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1'
const CHANNELS: { id: SendChannel; label: string; hint: string }[] = [
  { id: 'official', label: 'WhatsApp Official', hint: 'Dari nombor Official ke perbualan inbox. PDF dilampirkan. Perlu klien pernah mesej & tetingkap 24 jam terbuka.' },
  { id: 'template', label: 'Template Meta', hint: 'Bila tetingkap 24 jam tutup atau klien belum pernah WhatsApp nombor Official. Perlu template diluluskan Meta.' },
  { id: 'unofficial', label: 'Buka WhatsApp sendiri', hint: 'Buka WhatsApp akaun anda (nombor lama) dengan teks + pautan siap diisi. Tak masuk inbox.' },
  { id: 'email', label: 'Email', hint: 'PDF dilampirkan + pautan. Guna email klien pada sebut harga.' },
]
const waDigits = (phone: string) => { let p = phone.replace(/\D/g, ''); if (p.startsWith('0')) p = '60' + p.slice(1); else if (!p.startsWith('60')) p = '60' + p; return p }
const fmtDT = (v: string | null) => v ? new Date(v).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export function SendDocDialog({ quotationId, doc, initialChannel, onClose, onSent }: { quotationId: string; doc: DocKind; initialChannel?: SendChannel; onClose: () => void; onSent?: () => void }) {
  const [pre, setPre] = useState<Prefill | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [channel, setChannel] = useState<SendChannel>(initialChannel ?? 'official')
  const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [message, setMessage] = useState('')
  const [tpl, setTpl] = useState(''); const [saveDefault, setSaveDefault] = useState(false)
  const [busy, setBusy] = useState(false)
  const title = doc === 'invoice' ? 'invois' : 'sebut harga'

  const load = useCallback(async () => {
    setErr(null)
    try {
      const r = await fetch(`/api/admin/quotations/${quotationId}/send?doc=${doc}`); const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Gagal memuatkan'); return }
      const p = j as Prefill
      setPre(p); setPhone(p.phone); setEmail(p.email); setMessage(p.message)
      if (p.defaultTemplate) setTpl(`${p.defaultTemplate.name}|${p.defaultTemplate.language}`)
      if (!initialChannel) setChannel(p.conversation?.windowOpen ? 'official' : p.conversation && p.templates.length ? 'template' : p.conversation ? 'official' : 'unofficial')
    } catch { setErr('Ralat rangkaian') }
  }, [quotationId, doc, initialChannel])
  useEffect(() => { load() }, [load])

  const send = async () => {
    if (!pre) return
    if (channel === 'unofficial') {   // buka WhatsApp sendiri dahulu, kemudian rekod
      const digits = waDigits(phone); if (digits.length < 11) { toast.error('Nombor telefon klien tidak sah'); return }
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
    }
    setBusy(true)
    try {
      const template = tpl ? { name: tpl.split('|')[0], language: tpl.split('|')[1] || 'ms' } : undefined
      const r = await fetch(`/api/admin/quotations/${quotationId}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc, channel, phone, email, message, template, saveDefault }) })
      const j = await r.json()
      if (!r.ok) {
        if (j.windowClosed || j.noConversation) { setChannel(pre.templates.length ? 'template' : 'unofficial') }
        setErr(j.error || 'Gagal hantar'); return
      }
      toast.success(channel === 'email' ? `Email ${title} dihantar ke ${j.to}` : channel === 'unofficial' ? 'WhatsApp dibuka — tekan hantar dalam WhatsApp' : `${title[0].toUpperCase()}${title.slice(1)} dihantar ke WhatsApp ${j.to}`)
      onSent?.(); onClose()
    } catch { setErr('Ralat rangkaian') } finally { setBusy(false) }
  }

  const ch = CHANNELS.find(c => c.id === channel)!
  const conv = pre?.conversation ?? null
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg p-4" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Hantar ${title}`}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900 inline-flex items-center gap-2"><Send className="h-4 w-4" />Hantar {title}{pre ? ` ${pre.number}` : ''}</h2>
          <button type="button" onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-gray-100" aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>
        {!pre && !err && <p className="text-sm text-gray-500 py-6 text-center inline-flex items-center gap-2 w-full justify-center"><Loader2 className="h-4 w-4 animate-spin" />Memuatkan…</p>}
        {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{err}</p>}
        {pre && (
          <>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {CHANNELS.map(c => (
                <button key={c.id} type="button" onClick={() => { setChannel(c.id); setErr(null) }} className={`text-left rounded-lg border px-2.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 ${channel === c.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                  {c.id === 'email' ? <Mail className="h-3.5 w-3.5" /> : c.id === 'unofficial' ? <ExternalLink className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}{c.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mb-3">{ch.hint}</p>

            {channel === 'official' && (
              <p className={`text-xs rounded-lg px-3 py-2 mb-3 border ${conv?.windowOpen ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                {conv ? <>Perbualan dijumpai{conv.numberName ? ` (${conv.numberName})` : ''} · mesej terakhir klien {fmtDT(conv.lastInboundAt)} · tetingkap 24 jam <b>{conv.windowOpen ? 'terbuka' : 'tutup'}</b>{!conv.windowOpen ? ' — cuba template atau Buka WhatsApp sendiri.' : ''}</>
                  : <>Klien ini belum pernah WhatsApp nombor Official kita. Guna template Meta atau Buka WhatsApp sendiri.</>}
              </p>
            )}
            {channel === 'template' && (
              <div className="mb-3">
                <label className={lbl}>Template Meta (diluluskan)</label>
                {pre.templatesError && <p className="text-xs text-red-700 mb-1">{pre.templatesError}</p>}
                <select value={tpl} onChange={e => setTpl(e.target.value)} className={inp}>
                  <option value="">— Pilih template —</option>
                  {pre.templates.map(t => <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} · {t.language}{t.headerType === 'DOCUMENT' ? ' · PDF' : ''} · {t.bodyParams} parameter</option>)}
                </select>
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 mt-1.5"><input type="checkbox" checked={saveDefault} onChange={e => setSaveDefault(e.target.checked)} className="accent-gray-900" />Jadikan template lalai untuk {title}</label>
                <p className="text-[11px] text-gray-400 mt-1">Parameter diisi automatik: {'{{1}}'} nama klien · {'{{2}}'} nombor · {'{{3}}'} jumlah · {'{{4}}'} pautan. Header PDF dilampirkan jika template ada header dokumen.</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              {channel === 'email'
                ? <div className="sm:col-span-2"><label className={lbl}>Email klien</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inp} placeholder="email@klien.com" /></div>
                : <div className="sm:col-span-2"><label className={lbl}>No. WhatsApp klien</label><input value={phone} onChange={e => setPhone(e.target.value)} className={inp} placeholder="01x-xxxxxxx" /></div>}
            </div>
            {channel !== 'template' && (
              <div className="mb-3">
                <label className={lbl}>{channel === 'email' ? 'Mesej tambahan dalam email (pilihan — teks lalai di bawah tak dihantar jika tak diubah)' : 'Mesej'}</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={7} className={`${inp} font-mono text-xs`} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 mb-3">
              {pre.pdfUrl && <a href={pre.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900"><FileText className="h-3.5 w-3.5" />PDF yang dilampirkan</a>}
              {pre.link && <a href={pre.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900"><ExternalLink className="h-3.5 w-3.5" />Pautan klien</a>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={send} disabled={busy || (channel === 'template' && !tpl)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : channel === 'unofficial' ? <ExternalLink className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {channel === 'unofficial' ? 'Buka WhatsApp' : channel === 'email' ? 'Hantar email' : 'Hantar'}
              </button>
              <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50">Tutup</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
