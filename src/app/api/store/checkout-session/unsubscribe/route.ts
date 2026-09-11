// ============================================================
// api/store/checkout-session/unsubscribe — "Tak mahu peringatan ini".
// GET ?token=<token sesi> → set unsubscribed_at pada SEMUA sesi email itu +
// masuk email_suppressions (reason 'abandoned_checkout'). Hanya email
// PEMASARAN (peringatan troli) semak senarai ini; email transaksi kekal.
// Balas page HTML kecil (monokrom). Token = rahsia 32 aksara rawak, jadi
// tiada pengesahan lain diperlukan; burst gate ringan sahaja.
// ============================================================
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { safeClientIp } from '@/lib/order-guard'
import { appBaseUrl, isMissingTableError, TOKEN_RE } from '@/lib/checkout-session'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function page(status: number, title: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} — SyababFresh</title>
<style>
  body{margin:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827}
  main{max-width:440px;margin:48px auto;padding:0 16px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px 24px}
  h1{font-size:18px;margin:0 0 10px}
  p{font-size:14px;line-height:1.6;color:#374151;margin:0 0 14px}
  a.btn{display:inline-block;border:1px solid #111827;color:#111827;text-decoration:none;font-weight:700;font-size:13px;padding:10px 16px;border-radius:10px}
  small{display:block;margin-top:18px;font-size:12px;color:#9ca3af}
</style></head>
<body><main><div class="card"><h1>${esc(title)}</h1>${body}
<a class="btn" href="${appBaseUrl()}">Kembali ke SyababFresh</a>
<small>Email transaksi (resit, tracking pesanan) tidak terjejas.</small></div></main></body></html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const ip = safeClientIp(req)
  if (!rateLimit('csu:' + (ip ?? 'unknown'), 20, 10 * 60_000))
    return page(429, 'Terlalu banyak permintaan', '<p>Sila cuba sebentar lagi.</p>')

  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (!TOKEN_RE.test(token)) return page(400, 'Pautan tidak sah', '<p>Pautan nyah-langgan ini tidak lengkap.</p>')

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('checkout_sessions')
    .select('id, email')
    .eq('token', token)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return page(200, 'Selesai', '<p>Tiada peringatan troli yang aktif untuk pautan ini.</p>')
    return page(500, 'Ralat', '<p>Maaf, ada masalah sebentar. Sila cuba lagi.</p>')
  }
  if (!row) return page(404, 'Pautan tidak sah', '<p>Pautan ini tidak dijumpai atau sudah luput.</p>')

  const now = new Date().toISOString()
  await admin.from('checkout_sessions')
    .update({ unsubscribed_at: now, updated_at: now })
    .eq('email', row.email)
    .is('unsubscribed_at', null)
  const { error: supErr } = await admin.from('email_suppressions')
    .upsert({ email: row.email, reason: 'abandoned_checkout' }, { onConflict: 'email', ignoreDuplicates: true })
  if (supErr && !isMissingTableError(supErr)) console.warn('[checkout-session] suppression gagal:', supErr.message)

  return page(200, 'Peringatan dihentikan', `<p>Kami tidak akan hantar peringatan troli lagi ke <strong>${esc(row.email)}</strong>.</p>`)
}
