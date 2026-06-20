'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Mail, Loader2 } from 'lucide-react'

// Invois customer: download PDF + email. Guna semula generator invois sedia ada.
export function InvoiceActions({ orderId, canEmail }: { orderId: string; canEmail: boolean }) {
  const [sending, setSending] = useState(false)

  async function email() {
    setSending(true)
    const res = await fetch(`/api/admin/orders/${orderId}/invoice`, { method: 'POST' })
    setSending(false)
    if (!res.ok) { toast.error((await res.json().catch(() => ({})))?.error ?? 'Gagal hantar'); return }
    toast.success('Invois dihantar ke email customer')
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <a href={`/api/admin/orders/${orderId}/invoice`} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
        <FileText className="h-4 w-4" /> Invois
      </a>
      {canEmail && (
        <button onClick={email} disabled={sending} title="Email invois ke customer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        </button>
      )}
    </div>
  )
}
