import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

      if (referrer) {
        const alreadyReferred = await adminDb
          .from('referrals')
          .select('id')
          .eq('referee_id', data.user.id)
          .maybeSingle()

        if (!alreadyReferred.data) {
          await adminDb.from('referrals').insert({
            referrer_id: referrer.id,
            referee_id: data.user.id,
            ref_code: refCode,
            status: 'pending',
            referrer_pts: 100,
          })
        }
      }
    } catch {
      // silent — referral tracking should never block login
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
