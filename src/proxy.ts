import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Subdomain LP kurma (kurma.syababfresh.my) — aktif bila env NEXT_PUBLIC_KURMA_HOST diset.
//   kurma.<domain>/            → rewrite /kurma           (LP gift box)
//   kurma.<domain>/korporat    → rewrite /kurma/korporat  (begitu juga /borong, /portfolio, /studio, /berjaya/X)
//   kurma.<domain>/kurma/x     → 308 /x (laluan pendek = kanonik; aset opengraph-image dilalukan terus)
//   kurma.<domain>/agensi      → 308 /korporat
//   kurma.<domain>/sitemap.xml → rewrite /kurma/sitemap.xml · /robots.txt → /api/kurma/robots
//   shop.<domain>/kurma/x      → 308 https://kurma.<domain>/x (pautan/iklan lama kekal jalan)
//   kurma.<domain>/lp/<slug>   → dilalukan terus ke /lp/<slug> (LP builder admin dengan host='kurma',
//                                migration 145; page sendiri set canonical ikut hos — tiada DB di proxy)
//   kurma.<domain>/shop        → rewrite /kurma/shop (kedai kurma satu page, 23 Okt 2026); flow beli
//                                (/cart, /checkout, /orders, /resit, /products, /login, /daftar, /auth)
//                                dilalukan terus pada hos kurma + X-Robots-Tag noindex (kanonik = hos kedai)
//                                supaya troli (localStorage ikut origin) & checkout di hos yang sama.
// API, _next, ikon & fail statik dilalukan terus pada kedua-dua hos. Tiada auth diperlukan di subdomain.
const KURMA_HOST = process.env.NEXT_PUBLIC_KURMA_HOST ?? ''
const META_ASSET = /\/(opengraph|twitter)-image(\/|$|\?)/
// Laluan kedai yang perlu wujud di hos kurma untuk beli dari /shop (bukan page funnel)
const STORE_FLOW = /^\/(cart|checkout|orders|resit|products|login|daftar|auth|reset-password)(\/|$)/
const isPassThrough = (p: string) => p.startsWith('/_next') || p.startsWith('/api/') || p.startsWith('/icons/') || (/\.[a-z0-9]{2,5}$/i.test(p) && p !== '/robots.txt' && p !== '/sitemap.xml')

function kurmaHostRouting(request: NextRequest): NextResponse | null {
  if (!KURMA_HOST) return null
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  const url = request.nextUrl
  const p = url.pathname
  if (host === KURMA_HOST) {
    if (isPassThrough(p)) return NextResponse.next()
    if (p === '/lp' || p.startsWith('/lp/')) return NextResponse.next()
    if (STORE_FLOW.test(p)) { const res = NextResponse.next(); res.headers.set('X-Robots-Tag', 'noindex, follow'); return res }
    if (p === '/robots.txt') { const u = url.clone(); u.pathname = '/api/kurma/robots'; return NextResponse.rewrite(u) }
    if (p === '/sitemap.xml') { const u = url.clone(); u.pathname = '/kurma/sitemap.xml'; return NextResponse.rewrite(u) }
    if (p === '/agensi') { const u = url.clone(); u.pathname = '/korporat'; return NextResponse.redirect(u, 308) }
    if (p === '/kurma' || p.startsWith('/kurma/')) {
      if (META_ASSET.test(p) || p === '/kurma/sitemap.xml') return NextResponse.next()
      const u = url.clone(); u.pathname = p.replace(/^\/kurma/, '') || '/'; return NextResponse.redirect(u, 308)
    }
    const u = url.clone(); u.pathname = p === '/' ? '/kurma' : `/kurma${p}`
    return NextResponse.rewrite(u)
  }
  // Hos lain (kedai) → alihkan page kurma ke subdomain; aset metadata & sitemap kekal boleh dicapai
  if ((p === '/kurma' || p.startsWith('/kurma/')) && !META_ASSET.test(p) && p !== '/kurma/sitemap.xml') {
    const target = new URL(`https://${KURMA_HOST}${p.replace(/^\/kurma/, '') || '/'}${url.search}`)
    return NextResponse.redirect(target, 308)
  }
  return null
}

export async function proxy(request: NextRequest) {
  const hostRouted = kurmaHostRouting(request)
  if (hostRouted) return hostRouted

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
  // Admin routes — must be logged in AND is_admin.
  // Kecuali /admin-manifest.json (fail PWA awam — browser fetch tanpa auth).
  if (pathname.startsWith('/admin') && pathname !== '/admin-manifest.json') {
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
