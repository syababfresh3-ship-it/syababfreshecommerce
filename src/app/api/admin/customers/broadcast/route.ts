import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { sendBroadcastEmail } from '@/lib/zeptomail'

export const runtime = 'nodejs'

// Broadcast CRM dari All Contacts ke set customer yang ditapis. Channel WA / Email
// dipilih masa hantar. Opt-in default; `includeNonOptin` override (abai consent).
// Loop segerak + throttle → ada CAP audiens supaya tak timeout function Vercel.
// Server authoritative: tapis kelayakan channel + consent sendiri (jangan percaya client).
const CAP = { wa: 200, email: 500 } as const

type Channel = 'wa' | 'email'
interface Cust {
  id: string; name: string | null; phone_norm: string; email: string | null
  consent_wa: boolean | null; consent_email: boolean | null
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json().catch(() => ({}))
  const channel: Channel = body.channel === 'email' ? 'email' : 'wa'
  const message: string = typeof body.message === 'string' ? body.message.trim() : ''
  const subject: string = typeof body.subject === 'string' ? body.subject.trim() : ''
  const includeNonOptin = body.includeNonOptin === true
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : []

  if (!message) return NextResponse.json({ error: 'Mesej kosong' }, { status: 400 })
  if (channel === 'email' && !subject) return NextResponse.json({ error: 'Subject diperlukan untuk email' }, { status: 400 })
  if (!ids.length) return NextResponse.json({ error: 'Tiada penerima dipilih' }, { status: 400 })

  // Muat customer yang dipilih (chunk in() supaya tak terlalu panjang)
  const custs: Cust[] = []
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase!
      .from('customers')
      .select('id, name, phone_norm, email, consent_wa, consent_email')
      .in('id', ids.slice(i, i + 300))
    custs.push(...((data ?? []) as Cust[]))
  }

  // Tapis ikut kelayakan channel + consent (atau override)
  const eligible = custs.filter(c => {
    if (channel === 'wa') return !!c.phone_norm && (includeNonOptin || c.consent_wa === true)
    return !!c.email && (includeNonOptin || c.consent_email === true)
  })

  const cap = CAP[channel]
  if (eligible.length > cap) {
    return NextResponse.json(
      { error: `Terlalu ramai penerima (${eligible.length}). Had ${cap} setiap broadcast — sila tapis lebih kecil.` },
      { status: 422 },
    )
  }
  if (!eligible.length) return NextResponse.json({ sent: 0, failed: 0, skipped: custs.length, total: 0 })

  let sent = 0, failed = 0
  for (const c of eligible) {
    const personalised = message.replace(/\{nama\}/gi, c.name ?? 'Pelanggan')
    if (channel === 'wa') {
      const r = await sendWhatsApp(c.phone_norm, personalised)
      if ((r as any).success || (r as any).skipped) sent++; else failed++
      await new Promise(res => setTimeout(res, 200))
    } else {
      const ok = await sendBroadcastEmail({ to: c.email!, toName: c.name, subject, message: personalised })
      if (ok) sent++; else failed++
      await new Promise(res => setTimeout(res, 100))
    }
  }

  return NextResponse.json({ sent, failed, skipped: custs.length - eligible.length, total: eligible.length })
}
