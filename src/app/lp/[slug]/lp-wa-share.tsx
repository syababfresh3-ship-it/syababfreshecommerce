'use client'

import { useState } from 'react'
import { MessageCircle, Link2, Check } from 'lucide-react'

export function LpWaShare({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  function shareWa() {
    const url = window.location.href
    const text = encodeURIComponent(`${title} — ${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener')
    setOpen(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setOpen(false)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* Backdrop tutup menu */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
        {/* Mini menu */}
        {open && (
          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={shareWa}
              className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg whitespace-nowrap active:scale-95 transition-transform"
            >
              <MessageCircle className="h-4 w-4" fill="white" strokeWidth={0} />
              Kongsi via WhatsApp
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg border border-gray-200 whitespace-nowrap active:scale-95 transition-transform"
            >
              <Link2 className="h-4 w-4" />
              Salin Link
            </button>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setOpen(v => !v)}
          aria-label="Kongsi halaman"
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
            copied
              ? 'bg-green-600'
              : open
              ? 'bg-gray-800 rotate-45'
              : 'bg-[#25D366]'
          }`}
        >
          {copied
            ? <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
            : open
            ? <span className="text-white text-xl font-light leading-none">+</span>
            : <MessageCircle className="h-5 w-5 text-white" fill="white" strokeWidth={0} />
          }
        </button>
      </div>
    </>
  )
}
