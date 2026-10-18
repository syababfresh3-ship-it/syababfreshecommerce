'use client'

// Butang WhatsApp terus (fire 'Lead' sekali sesesi) untuk dipakai dalam server component
// (cth CTA akhir gift-landing) — openWaLead perlu window, jadi mesti client.
import type { CSSProperties, ReactNode } from 'react'
import { MessageCircle } from 'lucide-react'
import { openWaLead } from '@/lib/kurma-track'

export function KurmaWaLink({ angle, label, text, className, style, children }: {
  angle?: string
  label: string
  text: string
  className?: string
  style?: CSSProperties
  /** Label butang (lalai "WhatsApp terus") — LP korporat guna label pendek di header. */
  children?: ReactNode
}) {
  return (
    <button type="button" onClick={() => openWaLead(text, angle, 0, label)} className={className} style={style}>
      <MessageCircle className="h-5 w-5" />{children ?? 'WhatsApp terus'}
    </button>
  )
}
