'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Send, ImagePlus, Headset, ShoppingBag, MessageCircle, ArrowLeft } from 'lucide-react'
import { humanWaUrl } from '@/lib/support/constants'

interface Msg { role: 'user' | 'assistant'; content: string }

// Cadangan untuk pelanggan tahu apa AI boleh bantu (quick-reply)
const SUGGESTIONS = [
  '📦 Semak status & tracking order saya',
  '🍎 Buah saya sampai dalam keadaan rosak',
  '❓ Soalan produk atau harga',
]
const GUEST_SUGGESTIONS = [
  '🚚 Kawasan & kos penghantaran?',
  '🥭 Ada durian atau mangga?',
  '🛒 Macam mana nak buat order?',
]

export default function BantuanPage() {
  const router = useRouter()
  const goBack = () => { if (window.history.length > 1) router.back(); else router.push('/') }

  const [step, setStep] = useState<'identify' | 'chat'>('identify')
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const [token, setToken] = useState('')
  const [guest, setGuest] = useState(false)
  const [order, setOrder] = useState<{ number: string; status: string; name: string | null } | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  async function identify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/support/identify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, phone }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal')
      setToken(json.token)
      setOrder(json.order)
      const prior: Msg[] = json.messages ?? []
      setMessages(prior.length ? prior : [{
        role: 'assistant',
        content: `Hai ${json.order.name || ''}! 👋 Saya Pembantu SyababFresh. Order *${json.order.number}* anda berstatus *${json.order.status}*. Macam mana saya boleh bantu — semak penghantaran, soalan produk, atau ada masalah dengan buah?`,
      }])
      setStep('chat')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal')
    } finally { setLoading(false) }
  }

  async function startGuest() {
    setLoading(true)
    try {
      const res = await fetch('/api/support/guest')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal')
      setToken(json.token)
      setGuest(true)
      setOrder(null)
      setMessages([{
        role: 'assistant',
        content: 'Hai! 👋 Saya Pembantu SyababFresh. Tanya apa-apa tentang produk, harga, penghantaran, atau cara order. (Untuk semak order atau lapor masalah, kembali ke skrin utama & masukkan no order.)',
      }])
      setStep('chat')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal')
    } finally { setLoading(false) }
  }

  async function send(preset?: string) {
    const text = (preset ?? input).trim()
    if (!text || sending) return
    if (!preset) setInput('')
    const priorMsgs = messages
    setMessages((m) => [...m, { role: 'user', content: text }])
    setSending(true)
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, message: text, ...(guest ? { history: priorMsgs } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal')
      setMessages((m) => [...m, { role: 'assistant', content: json.reply }])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal')
      setMessages((m) => [...m, { role: 'assistant', content: 'Maaf, ada masalah. Cuba hantar sekali lagi.' }])
    } finally { setSending(false) }
  }

  async function uploadOne(file: File): Promise<boolean> {
    const fd = new FormData()
    fd.append('token', token)
    fd.append('file', file)
    const res = await fetch('/api/support/upload', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(json.error || 'Gagal upload'); return false }
    return true
  }

  // Boleh pilih beberapa gambar sekali gus (had 6). Upload berturutan.
  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    let ok = 0
    for (const f of files) { if (await uploadOne(f)) ok++ }
    if (ok > 0) {
      toast.success(`${ok} gambar dimuat naik`)
      setMessages((m) => [...m, { role: 'user', content: `📷 (${ok} gambar bukti dimuat naik)` }])
    }
    setUploading(false)
  }

  // ── Langkah 1: sahkan order ──
  if (step === 'identify') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <button onClick={goBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke kedai
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-brand-red-50"><Headset className="h-5 w-5 text-brand-red-600" /></div>
            <h1 className="text-lg font-bold text-gray-900">Bantuan SyababFresh</h1>
          </div>
          <p className="text-sm text-gray-400 mb-5">Masukkan no order &amp; telefon untuk mula. Pembantu AI kami akan bantu semak penghantaran atau selesaikan masalah.</p>
          <form onSubmit={identify} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">No Order</label>
              <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="cth LP-20260601-0001"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">No Telefon</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="cth 0123456789" inputMode="tel"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red-500" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-red-600 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-brand-red-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              Mula
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 mb-2">Belum buat order?</p>
            <button onClick={startGuest} disabled={loading}
              className="text-sm font-medium text-brand-red-600 hover:text-brand-red-700 disabled:opacity-50">
              Tanya soalan umum (produk, harga, penghantaran) →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Langkah 2: chat ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2.5 shrink-0">
        <button onClick={goBack} aria-label="Kembali" className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="p-2 rounded-xl bg-brand-red-50"><Headset className="h-4 w-4 text-brand-red-600" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-sm leading-tight">Pembantu SyababFresh</p>
          <p className="text-[11px] text-gray-400 truncate">{guest ? 'Soalan umum' : `Order ${order?.number} · ${order?.status}`}</p>
        </div>
        <a href={humanWaUrl(`Hai SyababFresh, saya nak bantuan untuk order ${order?.number ?? ''}.`)}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors shrink-0">
          <MessageCircle className="h-3.5 w-3.5" /> Manusia
        </a>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === 'user' ? 'bg-brand-red-600 text-white rounded-br-md' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
            }`}>{m.content}</div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
            </div>
          </div>
        )}
        {messages.length <= 1 && !sending && (
          <div className="flex flex-col items-start gap-2 pt-1">
            <p className="text-[11px] text-gray-400 px-1">Saya boleh bantu dengan:</p>
            {(guest ? GUEST_SUGGESTIONS : SUGGESTIONS).map((s) => (
              <button key={s} onClick={() => send(s)}
                className="text-sm text-gray-700 bg-white border border-gray-200 rounded-full px-3.5 py-2 hover:border-brand-red-300 hover:bg-brand-red-50/40 transition-colors text-left">
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </main>

      <footer className="bg-white border-t border-gray-100 px-3 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; uploadFiles(files) }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 shrink-0" title="Muat naik gambar">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </button>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="Taip mesej…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red-500 max-h-32" />
          <button onClick={() => send()} disabled={sending || !input.trim()}
            className="p-2.5 rounded-xl bg-brand-red-600 text-white hover:bg-brand-red-700 disabled:opacity-40 shrink-0">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  )
}
