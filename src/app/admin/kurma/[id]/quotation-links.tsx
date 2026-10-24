'use client'

// Sebut harga untuk gift order ini (modul Sebut Harga, migration 146): senarai + butang
// cipta pra-isi (/admin/quotations/new?gift=<id>). Additive — panel Quote & payment tak disentuh.
// Jadual belum wujud → senarai kosong senyap (API 500 ditelan).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { rm, statusLabel, type Quotation } from '@/lib/quotation'

export function GiftQuotationLinks({ orderId }: { orderId: string }) {
  const [rows, setRows] = useState<(Quotation & { expired?: boolean })[]>([])
  useEffect(() => {
    let alive = true
    fetch(`/api/admin/quotations?source_id=${orderId}`).then(r => r.ok ? r.json() : { quotations: [] }).then(j => { if (alive) setRows(j.quotations ?? []) }).catch(() => {})
    return () => { alive = false }
  }, [orderId])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Sebut harga</p>
        <Link href={`/admin/quotations/new?gift=${orderId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50"><Plus className="h-3.5 w-3.5" />Sebut harga baharu</Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 mt-2">Belum ada sebut harga untuk order ini. Butang di atas pra-isi klien & baris dari order.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 text-sm">
          {rows.map(q => (
            <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              <Link href={`/admin/quotations/${q.id}`} className="font-semibold text-gray-900 hover:underline">{q.quote_number ?? 'Draf'}</Link>
              <span className="text-xs text-gray-500">{q.expired ? 'Luput' : statusLabel(q.status)}</span>
              <span className="ml-auto font-mono text-gray-900">{rm(q.total)}</span>
              <a href={`/api/admin/quotations/${q.id}/pdf`} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-900" title="PDF"><FileText className="h-4 w-4" /></a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
