'use client'

import { MessageCircle, Check, Plus } from 'lucide-react'
import { openWaLead } from '@/lib/kurma-track'
import { rowWaText } from '@/lib/borong-copy'
import { useBorong } from './borong-context'

export function CatalogRowActions({ name, pack, refPriceCtn }: { name: string; pack: string; refPriceCtn: number | null }) {
  const { picks, togglePick } = useBorong()
  const picked = picks.includes(name)
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button type="button" onClick={() => togglePick(name)} aria-pressed={picked} className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1.5 rounded-lg border ${picked ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>
        {picked ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{picked ? 'Dipilih' : 'Pilih'}
      </button>
      <button type="button" onClick={() => openWaLead(rowWaText(name, pack, refPriceCtn), 'borong', 0, 'borong-row-wa')} aria-label={`WhatsApp harga ${name}`} className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1.5 rounded-lg text-white" style={{ background: '#25D366' }}>
        <MessageCircle className="h-3.5 w-3.5" />{refPriceCtn != null ? 'Tanya' : 'Minta harga'}
      </button>
    </div>
  )
}
