export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tawaran masa terhad LP (migration 159) — keadaan untuk pelayar.
//   POST → mod visitor: baca/tetapkan cookie masa mula (HMAC, HttpOnly, hayat = cooldown) → { enabled, offer, state }
//   GET  → sama tetapi TIDAK set cookie (pratonton/semak sahaja)
// Page LP kekal ISR (tak baca cookie masa render) — klien panggil ini selepas mount (lib/stores/lp-flash.ts).
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { flashCookieName, flashWindow, publicFlashOffer } from '@/lib/lp-flash'
import { loadFlashOffer, readCookie, signFlashToken, verifyFlashToken } from '@/lib/lp-flash-server'

async function handle(request: Request, slug: string, setCookie: boolean) {
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ enabled: false }, { status: 400 })
  const { offer } = await loadFlashOffer(createAdminClient(), slug)
  const noStore = { 'Cache-Control': 'no-store' }
  if (!offer?.enabled) return NextResponse.json({ enabled: false }, { headers: noStore })

  const now = Date.now()
  if (offer.mode === 'scheduled') {
    return NextResponse.json({ enabled: true, offer: publicFlashOffer(offer), state: flashWindow(offer, { now }) }, { headers: noStore })
  }

  // Mod visitor: token cookie = masa mula. Tiada/rosak/lebih lama dari cooldown → timer baharu (POST sahaja).
  const name = flashCookieName(slug)
  let startedAt = verifyFlashToken(readCookie(request.headers.get('cookie'), name))
  if (startedAt != null && now - startedAt > offer.cooldown_hours * 3_600_000) startedAt = null
  let fresh = false
  if (startedAt == null && setCookie) { startedAt = now; fresh = true }

  const res = NextResponse.json({ enabled: true, offer: publicFlashOffer(offer), state: flashWindow(offer, { startedAt, now }), started: startedAt != null }, { headers: noStore })
  if (fresh && startedAt != null) {
    res.cookies.set(name, signFlashToken(startedAt), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: offer.cooldown_hours * 3600,
    })
  }
  return res
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return handle(request, slug, true)
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return handle(request, slug, false)
}
