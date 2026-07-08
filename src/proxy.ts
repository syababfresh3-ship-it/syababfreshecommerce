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

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Auth callback & reset-password must never be blocked
  if (pathname.startsWith('/auth') || pathname === '/reset-password') {
    return supabaseResponse
  }

  // Logged-in users shouldn't see login/daftar
  if (user && (pathname === '/login' || pathname === '/daftar')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Protected routes — redirect to login if not authenticated.
  // NOTA: /checkout SENGAJA tidak dilindungi — guest checkout dibenarkan (page
  // checkout sendiri bercabang guest vs member). /orders kekal dilindungi (sejarah
  // order member); guest guna pautan resit /resit/[id].
  // /orders + /profile SENGAJA tak dilindungi — guest boleh tengok view guest (CTA
  // login + jejak pesanan ikut telefon). /orders/[id] self-gate di page; alamat kekal gated.
  const protectedPaths = ['/profile/addresses', '/loyalty', '/wishlist', '/notifications', '/vouchers', '/tetapan']
  const isProtected = protectedPaths.some(path => pathname.startsWith(path))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // ⚠️ AMARAN: middleware ini hanya lindungi PAGE (/admin/*). API di /api/admin/*
  // TIDAK dilindungi di sini (path mula dengan /api). Setiap route /api/admin/*
  // WAJIB panggil requireAdmin() sendiri — kalau tertinggal, route jadi PUBLIC.
  // Admin routes — must be logged in AND is_admin
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
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
