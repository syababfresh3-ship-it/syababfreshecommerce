import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { safeClientIp, isHoneypotFilled } from '@/lib/order-guard'
import { normalizeLiveConfig } from '@/lib/lp-live'
import { sendAdminPush } from '@/lib/push'

// ============================================================
// POST /api/lp/[slug]/comment — komen penonton pada LP template 'live'.
// Disimpan 'pending' (lp_live_comments, migration 121); dipaparkan di page
// hanya selepas admin luluskan. Anti-spam: rate limit 5/IP/10min + honeypot.
// ============================================================

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: 'Tidak sah' }, { status: 400 })

  const ip = safeClientIp(request)
  if (!rateLimit('lpc:' + (ip ?? 'unknown'), 5, 10 * 60_000))
    return NextResponse.json({ error: 'Terlalu banyak komen. Cuba sebentar lagi.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  // Honeypot: bot isi medan tersembunyi → pura-pura berjaya, tiada apa disimpan
  if (isHoneypotFilled(body)) return NextResponse.json({ ok: true })

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 200) : ''
  const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (name.length < 2) return NextResponse.json({ error: 'Nama diperlukan' }, { status: 400 })
  if (message.length < 1) return NextResponse.json({ error: 'Komen kosong' }, { status: 400 })
  if (phoneRaw && !/^[0-9+\s-]{8,15}$/.test(phoneRaw)) return NextResponse.json({ error: 'No. telefon tidak sah' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: page } = await supabase
    .from('landing_pages')
    .select('id, title, template, live_config')
    .eq('slug', slug).eq('is_active', true).single()
  if (!page || page.template !== 'live') return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  if (!normalizeLiveConfig(page.live_config).allow_comments)
    return NextResponse.json({ error: 'Komen ditutup untuk page ini' }, { status: 403 })

  const ipHash = ip ? createHash('sha256').update(ip + (process.env.CRON_SECRET ?? '')).digest('hex').slice(0, 16) : null
  const { error } = await supabase.from('lp_live_comments').insert({
    page_id: page.id, name, message, phone: phoneRaw || null, status: 'pending', ip_hash: ipHash,
  })
  if (error) {
    console.error('[lp-comment] insert gagal', error.message)
    // 42P01 = jadual belum wujud (migration 121 belum dijalankan)
    const msg = (error.code === '42P01' || error.code === 'PGRST205') ? 'Komen belum diaktifkan buat masa ini' : 'Gagal simpan komen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Beritahu admin (push) — fire and forget
  sendAdminPush({
    title: `Komen baru: ${page.title}`,
    body: `${name}: ${message.slice(0, 90)}`,
    url: `/admin/landing-pages/comments?page=${page.id}`,
    tag: 'lp-comment',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
