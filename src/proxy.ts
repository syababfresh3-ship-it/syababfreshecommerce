import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Auth routes — skip protection
  if (pathname.startsWith('/auth') || pathname === '/reset-password') {
    return supabaseResponse
  }

  // Logged-in users yang cuba buka login/daftar — redirect ke home
  if (user && (pathname === '/login' || pathname === '/daftar')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Protected routes — redirect to login if not authenticated
  const protectedPaths = ['/checkout', '/orders', '/profile', '/loyalty']
  const isProtected = protectedPaths.some(path => pathname.startsWith(path))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Sanitize: only allow internal paths (start with /)
    const redirectTo = pathname.startsWith('/') ? pathname : '/'
    url.searchParams.set('redirect', redirectTo)
    return NextResponse.redirect(url)
  }

  // Admin routes — check auth + is_admin flag
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
