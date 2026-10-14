'use client'

// Butang WhatsApp terus (fire 'Lead' sekali sesesi) untuk dipakai dalam server component
// (cth CTA akhir gift-landing) — openWaLead perlu window, jadi mesti client.
import type { CSSProperties } from 'react'
import { MessageCircle } from 'lucide-react'
import { openWaLead } from '@/lib/kurma-track'

export function KurmaWaLink({ angle, label, text, className, style }: {
  angle?: string
  label: string
  text: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <button type="button" onClick={() => openWaLead(text, angle, 0, label)} className={className} style={style}>
      <MessageCircle className="h-5 w-5" />WhatsApp terus
    </button>
  )
}
