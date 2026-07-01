import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardLpLoyalty } from '@/lib/lp-loyalty'
import { ensureWelcomeVoucher } from '@/lib/welcome-voucher'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Validate next to prevent open redirect — only allow relative paths
  const rawNext = searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
  const refCode = searchParams.get('ref')

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
  }

  // If coming from password reset, send to reset-password page
  const type = searchParams.get('type')
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', request.url))
  }

  // Retroactive loyalty: credit delivered LP orders that match this user's phone
  // (e.g. they ordered via a landing page as a guest, then registered later)
  if (data.user) {
    try {
      const adminDb = createAdminClient()
      const { data: prof } = await adminDb.from('profiles').select('phone').eq('id', data.user.id).single()
      const seen = new Set<string>()
      // Padan ikut telefon (normalize 9 digit, via RPC)
      if (prof?.phone) {
        const { data: lpOrders } = await adminDb.rpc('lp_orders_for_phone', { p_phone: prof.phone })
        for (const o of (lpOrders ?? [])) {
          if (seen.has(o.id)) continue
          seen.add(o.id)
          await awardLpLoyalty(adminDb, o)
        }
      }
      // Padan ikut email — perlu untuk login Google (tiada telefon). Order guest
      // storefront yang sudah delivered & belum dikira points dituntut di sini.
      const email = (data.user.email ?? '').trim().toLowerCase()
      if (email) {
        const { data: byEmail } = await adminDb
          .from('lp_guest_orders')
          .select('id, order_number, phone, total, payment_method, payment_status, user_id, source, email')
          .ilike('email', email)
          .eq('status', 'delivered')
          .eq('loyalty_awarded', false)
          .limit(50)
        for (const o of (byEmail ?? [])) {
          if (seen.has(o.id)) continue
          seen.add(o.id)
          await awardLpLoyalty(adminDb, o)
        }
      }
      // Welcome voucher RM5 (idempotent — 1 per akaun)
      await ensureWelcomeVoucher(adminDb, data.user.id)
    } catch { /* non-fatal */ }
  }

  // Track referral for OAuth signups — use admin client directly, no HTTP fetch
  // (fetch would silently fail because session cookie isn't forwarded in SSR context)
  if (refCode && data.user) {
    try {
      const adminDb = createAdminClient()
      const { data: referrer } = await adminDb
        .from('profiles')
        .select('id')
        .eq('referral_code', refCode)
        .single()

      if (referrer && referrer.id !== data.user.id) {
        // Cap: max 20 referrals per month
        const monthStart = new Date()
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
        const { count: monthlyCount } = await adminDb
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', referrer.id)
          .gte('created_at', monthStart.toISOString())

        const alreadyReferred = await adminDb
          .from('referrals')
          .select('id')
          .eq('referee_id', data.user.id)
          .maybeSingle()

        if (!alreadyReferred.data && (monthlyCount ?? 0) < 20) {
          await adminDb.from('referrals').insert({
            referrer_id: referrer.id,
            referee_id: data.user.id,
            status: 'pending',
            referee_pts: 50,
            referrer_pts: 100,
          })
          // Award referee 50 welcome pts (same as email signup flow)
          await adminDb.from('loyalty_transactions').insert({
            user_id: data.user.id,
            points: 50,
            type: 'earn',
            description: 'Ganjaran rujukan — selamat datang!',
          })
          await adminDb.rpc('increment_points', { uid: data.user.id, pts: 50 })
        }
      }
    } catch {
      // silent — referral tracking should never block login
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
