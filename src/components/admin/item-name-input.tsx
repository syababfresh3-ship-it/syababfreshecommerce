'use client'

// Input nama item dengan cadangan dari katalog website (produk, varian, kotak & isi gift) —
// GET /api/admin/quotations/items?q=. Pilih → nama (+kadar & unit jika ada). Nama manual tetap boleh.
import { useEffect, useRef, useState } from 'react'
import { Package } from 'lucide-react'

export interface ItemHit { source: 'product' | 'variant' | 'gift_box' | 'gift_filling'; name: string; description: string | null; rate: number; unit: string }
const SOURCE_LABEL: Record<ItemHit['source'], string> = { product: 'Produk', variant: 'Varian', gift_box: 'Kotak gift', gift_filling: 'Isi gift' }
const rm = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function ItemNameInput({ value, onChange, onPick, className, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; onPick: (h: ItemHit) => void
  className?: string; placeholder?: string; disabled?: boolean
}) {
  const [hits, setHits] = useState<ItemHit[]>([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const picked = useRef(false)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (picked.current) { picked.current = false; return }
    const q = value.trim()
    // Semua setState dalam timeout (lint react-hooks/set-state-in-effect)
    timer.current = setTimeout(async () => {
      if (!focused || q.length < 2) { setHits([]); return }
      try {
        const res = await fetch(`/api/admin/quotations/items?q=${encodeURIComponent(q)}`)
        const j = await res.json().catch(() => [])
        setHits(Array.isArray(j) ? j : []); setOpen(true)
      } catch { setHits([]) }
    }, !focused || q.length < 2 ? 0 : 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [value, focused])

  return (
    <div className="relative">
      <input value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150) }}
        placeholder={placeholder} disabled={disabled} className={className} autoComplete="off" />
      {open && focused && hits.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg text-sm">
          {hits.map((h, i) => (
            <li key={i}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { picked.current = true; onPick(h); setOpen(false); setHits([]) }} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="flex-1 min-w-0"><span className="block font-semibold text-gray-900 truncate">{h.name}</span><span className="block text-[11px] text-gray-500">{SOURCE_LABEL[h.source]}{h.description ? ` · ${h.description}` : ''}</span></span>
                <span className="text-xs font-mono text-gray-700 shrink-0">{h.rate > 0 ? `${rm(h.rate)} / ${h.unit}` : '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
