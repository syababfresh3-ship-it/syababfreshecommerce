import { NextResponse } from 'next/server'
import { safeClientIp } from '@/lib/order-guard'
import { rateLimitDb } from '@/lib/rate-limit-db'
import { sendCapiKurmaLead } from '@/lib/meta-capi'
import { LEAD_ANGLES } from '@/lib/gift-copy'

// POST /api/kurma/lead — CAPI 'Lead' pelayan untuk LP kurma, dengan event_id SAMA seperti
// pixel pelayar (kurma-track.ts) → Meta dedup. Pulihkan isyarat yang pixel hilang (iOS/adblocker).
// Tiada PII; padanan fbc/fbp cookie + IP + user-agent sahaja. Fire-and-forget; sentiasa 204 —
// endpoint ini tak pernah gagalkan aliran WhatsApp pelanggan.
export async function POST(request: Request) {
  const ip = safeClientIp(request)
  // Anti-spam ringan: elak endpoint dipakai untuk cemar data Lead di Meta.
  if (!(await rateLimitDb('klead:' + (ip ?? 'unknown'), 10, 60_000))) return new NextResponse(null, { status: 204 })

  const body = (await request.json().catch(() => null)) as {
    eventId?: unknown; label?: unknown; angle?: unknown; estimate?: unknown
    utm?: { source?: unknown; campaign?: unknown; content?: unknown }
  } | null

  // eventId = UUID (crypto.randomUUID) atau fallback `lead_<ts>_<rand>` dari kurma-track.ts
  const eventId = typeof body?.eventId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.eventId) ? body.eventId : null
  if (!eventId) return new NextResponse(null, { status: 204 })

  const label = typeof body?.label === 'string' ? body.label.slice(0, 64) : 'gift-kurma'
  const angle = typeof body?.angle === 'string' && LEAD_ANGLES.includes(body.angle) ? body.angle : undefined
  const estimate = typeof body?.estimate === 'number' && Number.isFinite(body.estimate) && body.estimate > 0 && body.estimate < 1_000_000
    ? Math.round(body.estimate) : undefined
  const str = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 100) : undefined)
  const utm = { source: str(body?.utm?.source), campaign: str(body?.utm?.campaign), content: str(body?.utm?.content) }

  const cookieHeader = request.headers.get('cookie') ?? ''
  const fbc = cookieHeader.match(/(?:^|;\s*)_fbc=([^;]+)/)?.[1] ?? null
  const fbp = cookieHeader.match(/(?:^|;\s*)_fbp=([^;]+)/)?.[1] ?? null
  const userAgent = request.headers.get('user-agent') ?? null

  sendCapiKurmaLead({ eventId, label, angle, estimate, utm, clientIp: ip, userAgent, fbc, fbp }).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
