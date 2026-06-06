'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Mail, Loader2 } from 'lucide-react'

export function ResellerInvoiceActions({ orderId }: { orderId: string }) {
  const [sending, setSending] = useState(false)

  async function email() {
    setSending(true)
    const res = await fetch(`/api/admin/resellers/invoice/${orderId}`, { method: 'POST' })
    setSending(false)
    if (!res.ok) { toast.error((await res.json().catch(() => ({})))?.error ?? 'Gagal hantar'); return }
    toast.success('Invois dihantar ke email reseller')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-violet-600" /> Invois Reseller</h2>
      <div className="flex gap-2">
        <a href={`/api/admin/resellers/invoice/${orderId}`} target="_blank" rel="noopener noreferrer"
          className="flex-1 text-center text-sm font-semibold text-white bg-violet-600 px-3 py-2 rounded-xl hover:bg-violet-700">Download PDF</a>
        <button onClick={email} disabled={sending}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-violet-700 border border-violet-200 bg-violet-50 px-3 py-2 rounded-xl hover:bg-violet-100 disabled:opacity-50">
          {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Menghantar…</> : <><Mail className="h-4 w-4" /> Email</>}
        </button>
      </div>
    </div>
  )
}
