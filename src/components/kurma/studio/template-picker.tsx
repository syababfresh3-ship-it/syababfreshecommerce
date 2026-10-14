'use client'

// Grid template design (gift_designs aktif) — aria-pressed, pilihan "Tiada template" (kami reka).
import { Loader2, Check } from 'lucide-react'
import type { GiftDesign } from '@/lib/gift'

export function TemplatePicker({ templates, loading, selectedId, onSelect }: {
  templates: GiftDesign[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div>
      <p id="studio-template" className="text-xs font-bold uppercase tracking-wide text-gray-400">1. Pilih template</p>
      {loading ? (
        <div className="py-8 text-center text-gray-300"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500 mt-2">Tiada template buat masa ini — upload logo anda, kami reka design untuk anda.</p>
      ) : (
        <div role="group" aria-labelledby="studio-template" className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-2">
          {templates.map(d => {
            const on = selectedId === d.id
            return (
              <button key={d.id} type="button" aria-pressed={on} onClick={() => onSelect(on ? null : d.id)} className={`relative rounded-xl overflow-hidden border-2 text-left transition active:scale-[0.98] ${on ? 'border-[#E11D2A]' : 'border-gray-200 hover:border-gray-400'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.image_url ?? ''} alt={d.name} loading="lazy" decoding="async" className="w-full aspect-[4/3] object-cover bg-gray-50" />
                <div className="px-2.5 py-2 text-[12px] font-semibold text-gray-800 truncate">{d.name}</div>
                {on && <span className="absolute top-2 right-2 h-6 w-6 rounded-full grid place-items-center text-white" style={{ background: '#E11D2A' }}><Check className="h-3.5 w-3.5" /></span>}
              </button>
            )
          })}
        </div>
      )}
      {selectedId && <button type="button" onClick={() => onSelect(null)} className="text-[12px] text-gray-500 underline underline-offset-2 mt-2">Tiada template — kami cadangkan design</button>}
    </div>
  )
}
