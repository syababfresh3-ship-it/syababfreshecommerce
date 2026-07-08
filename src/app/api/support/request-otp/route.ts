export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, isValidPhone } from '@/lib/phone'
import { checkRateLimit, issueOtp } from '@/lib/support/otp'
import { sendWhatsApp } from '@/lib/murpati'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// Hantar OTP ke WhatsApp nombor pelanggan. Perlu sebelum /api/support/identify
// akan dedah sebarang PII. Ada had kadar (60s cooldown, max 5/jam per nombor + per IP).
export async function POST(req: Request) {
  // Had kadar per IP — halang seorang spam banyak nombor berbeza.
  if (!rateLimit(`otp:${clientIp(req)}`, 15, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Cuba lagi kemudian.' }, { status: 429 })
  }

  const { phone }: { phone?: string } = await req.json().catch(() => ({}))
  const phoneNorm = normalizePhone(phone)
  if (!isValidPhone(phoneNorm)) {
    return NextResponse.json({ error: 'Sila masukkan no telefon yang sah.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const rl = await checkRateLimit(admin, phoneNorm)
  if (!rl.ok) return NextResponse.json({ error: rl.error }, { status: 429 })

  const code = await issueOtp(admin, phoneNorm)

  const message =
    `*SyababFresh* 🍒\n\n` +
    `Kod pengesahan anda: *${code}*\n\n` +
    `Sah untuk 5 minit. Jangan kongsi kod ini dengan sesiapa — pasukan kami tidak akan minta kod ini.`

  const res = await sendWhatsApp(phoneNorm, message)

  // Dalam dev (Murpati tak dikonfig), log kod supaya boleh test.
  if ((res as { skipped?: boolean }).skipped && process.env.NODE_ENV !== 'production') {
    console.log(`[DEV OTP] ${phoneNorm} → ${code}`)
  }

  // Jangan bocor sama ada nombor wujud atau tak — sentiasa pulang ok.
  return NextResponse.json({ ok: true })
}
