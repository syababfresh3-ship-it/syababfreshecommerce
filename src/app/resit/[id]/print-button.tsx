'use client'

import { Printer } from 'lucide-react'

// Print → "Save as PDF" gives the customer a downloadable receipt with no PDF
// library on our side. `print:hidden` keeps this button out of the printout.
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden w-full flex items-center justify-center gap-2 bg-brand-red-600 text-white font-bold py-3.5 rounded-2xl text-sm shadow-[0_4px_16px_rgba(225,29,42,0.35)] active:scale-[0.98] transition-transform"
    >
      <Printer className="h-4 w-4 opacity-80" />
      Cetak / Muat Turun PDF
    </button>
  )
}
