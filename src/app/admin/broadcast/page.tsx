'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Send, Users, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react'

interface Result { sent: number; failed: number; total: number }

export default function BroadcastPage() {
  const [message, setMessage] = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    fetch('/api/admin/broadcast')
      .then(r => r.json())
      .then(d => setRecipientCount(d.count))
  }, [])

  const charCount = message.length
  const preview = message.replace(/\{nama\}/gi, 'Ahmad')

  async function handleSend() {
    if (!message.trim()) return toast.error('Tulis mesej dahulu')
    if (!confirm(`Hantar ke ${recipientCount} penerima? Tindakan ini tidak boleh dibatalkan.`)) return

    setSending(true)
    setResult(null)
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    setSending(false)

    if (res.ok) {
      const data = await res.json()
      setResult(data)
      toast.success(`Berjaya hantar ke ${data.sent} penerima`)
    } else {
      toast.error('Gagal hantar broadcast')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">WhatsApp Broadcast</h1>
        <p className="text-sm text-gray-500 mt-1">Hantar mesej ke pelanggan yang opt-in WhatsApp marketing</p>
      </div>

      {/* Recipient count */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">
            {recipientCount === null ? 'Mengira...' : `${recipientCount} penerima`}
          </p>
          <p className="text-xs text-gray-500">Pelanggan dengan nombor telefon & opt-in aktif</p>
        </div>
      </div>

      {/* Compose */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-bold text-gray-900">Tulis Mesej</h2>
        </div>

        <div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            placeholder={`Hai {nama}! 👋\n\nKami ada tawaran istimewa untuk anda hari ini...`}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-400">Guna <code className="bg-gray-100 px-1 rounded">{'{nama}'}</code> untuk nama pelanggan</p>
            <p className={`text-xs font-medium ${charCount > 900 ? 'text-red-500' : 'text-gray-400'}`}>{charCount} / 1000</p>
          </div>
        </div>

        {/* Preview */}
        {message && (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview (Ahmad)</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{preview}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || !message.trim() || recipientCount === 0}
          className="w-full flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-60 hover:bg-green-600 transition-colors"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menghantar... ({recipientCount} penerima)
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Hantar Broadcast
            </>
          )}
        </button>

        {sending && (
          <p className="text-xs text-center text-gray-400">Sila tunggu — menghantar satu persatu untuk elak spam</p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Keputusan Broadcast</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-xl p-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
              <p className="text-lg font-black text-green-600">{result.sent}</p>
              <p className="text-xs text-gray-500">Berjaya</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <AlertCircle className="h-5 w-5 text-red-400 mx-auto mb-1" />
              <p className="text-lg font-black text-red-500">{result.failed}</p>
              <p className="text-xs text-gray-500">Gagal</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <Users className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-lg font-black text-gray-600">{result.total}</p>
              <p className="text-xs text-gray-500">Jumlah</p>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700 space-y-1.5">
        <p className="font-bold">Tips broadcast berkesan:</p>
        <p>• Hantar pada waktu pagi (8–10am) atau petang (4–6pm)</p>
        <p>• Masukkan tawaran yang jelas dan CTA (Call-to-Action)</p>
        <p>• Jangan hantar lebih dari 2x seminggu untuk elak diblock</p>
        <p>• Guna <code className="bg-amber-100 px-1 rounded">{'{nama}'}</code> untuk personalisasi — kadar buka lebih tinggi</p>
      </div>
    </div>
  )
}
