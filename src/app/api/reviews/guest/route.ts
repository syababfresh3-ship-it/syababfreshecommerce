import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { safeClientIp } from '@/lib/order-guard'
import { verifyReviewToken } from '@/lib/review-token'
import { loadReviewOrder, saveOrderReviews } from '@/lib/review-order'

// ============================================================
// POST /api/reviews/guest — simpan ulasan dari pautan bertoken (/ulasan?t=...).
// Tanpa login; token HMAC sahaja yang membuktikan pemilikan order.
// ============================================================

export async function POST(request: Request) {
  const ip = safeClientIp(request)
  if (!rateLimit('rev:' + (ip ?? 'unknown'), 10, 10 * 60_000))
    return NextResponse.json({ error: 'Terlalu banyak cubaan. Cuba sebentar lagi.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const tok = verifyReviewToken(typeof body.token === 'string' ? body.token : null)
  if (!tok) return NextResponse.json({ error: 'Pautan tidak sah atau telah tamat' }, { status: 401 })

  const reviews = Array.isArray(body.reviews) ? body.reviews.slice(0, 20) : []
  if (reviews.length === 0) return NextResponse.json({ error: 'Tiada ulasan dihantar' }, { status: 400 })

  const sb = createAdminClient()
  const order = await loadReviewOrder(sb, tok.source, tok.orderId)
  if (!order) return NextResponse.json({ error: 'Order tidak dijumpai' }, { status: 404 })
  if (order.status === 'cancelled' || order.status === 'refunded')
    return NextResponse.json({ error: 'Order ini telah dibatalkan' }, { status: 400 })

  const result = await saveOrderReviews(sb, order, reviews.map((r: { product_id?: unknown; rating?: unknown; comment?: unknown }) => ({
    product_id: String(r.product_id ?? ''),
    rating: Number(r.rating),
    comment: typeof r.comment === 'string' ? r.comment : null,
  })))
  if (result.error) return NextResponse.json({ error: result.error, saved: result.saved }, { status: 500 })
  return NextResponse.json({ ok: true, saved: result.saved })
}
