'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Send, Loader2 } from 'lucide-react'

// Admin receipt controls: open the official receipt, or WhatsApp it to the customer.
// `canSend` is false when there's no customer phone on file.
export function ReceiptActions({ orderId, canSend = true }: { orderId: string; canSend?: boolean }) {
  const [sending, setSending] = useState(false)

  async function sendReceipt() {
    setSending(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/send-receipt`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(data.skipped ? 'WhatsApp tidak dikonfigurasi (dilangkau)' : 'Resit dihantar ke WhatsApp customer ✅')
      } else {
        toast.error(data.error ?? 'Gagal hantar resit')
      }
    } catch {
      toast.error('Gagal hantar resit')
    }
    setSending(false)
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/resit/${orderId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 shadow-sm transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        Resit
      </a>
      {canSend && (
        <button
          onClick={sendReceipt}
          disabled={sending}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 disabled:opacity-50 transition-colors"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Hantar WA Resit
        </button>
      )}
    </div>
  )
}
