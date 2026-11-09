'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

// Sheet ringkas untuk POS: bottom sheet pada telefon, panel kanan pada tablet (side='right').
// Dibina sendiri (projek tiada komponen Dialog/Sheet shadcn). Escape / ketuk latar = tutup.

export function PosSheet({ open, onClose, title, children, side = 'bottom', wide = false }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; side?: 'bottom' | 'right'; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  const panel = side === 'right'
    ? `fixed inset-y-0 right-0 w-full ${wide ? 'lg:w-[560px]' : 'lg:w-[440px]'} bg-white shadow-2xl flex flex-col`
    : `fixed inset-x-0 bottom-0 max-h-[92dvh] lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[88dvh] ${wide ? 'lg:max-w-2xl' : 'lg:max-w-md'} bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl flex flex-col`
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={panel} style={{ paddingBottom: side === 'bottom' ? 'env(safe-area-inset-bottom)' : undefined }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <h2 className="text-[16px] font-extrabold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 -mr-2 grid place-items-center rounded-full text-gray-500 hover:bg-gray-100 active:bg-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
