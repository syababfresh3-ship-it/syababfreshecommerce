import type { MetadataRoute } from 'next'

// robots.txt sebagai metadata route (gantikan public/robots.txt yang statik).
//
// Kenapa: fail statik tak boleh bezakan production vs preview — deployment
// preview Vercel (*.vercel.app) dan localhost sepatutnya tak diindeks langsung.
// Peraturan lama dari public/robots.txt dikekalkan semuanya; ditambah laluan
// yang tak patut diindeks: /lp/ (landing page pendua produk), /orders, /resit/,
// /login, /daftar, /reset-password, /checkout (tanpa slash — cover ?failed=1),
// /cart.
//
// Nota: JANGAN cipta semula public/robots.txt — fail statik akan bayangi route ini.
const SITEMAP_URL = 'https://shop.syababfresh.my/sitemap.xml'

export default function robots(): MetadataRoute.Robots {
  // Bukan production (preview / development / local) → sekat semua crawler.
  if (process.env.VERCEL_ENV !== 'production') {
    return {
      rules: { userAgent: '*', disallow: '/' },
      sitemap: SITEMAP_URL,
    }
  }

  return {
    rules: [
      { userAgent: 'facebookexternalhit', allow: '/' },
      { userAgent: 'Twitterbot', allow: '/' },
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Peraturan asal (public/robots.txt)
          '/api/',
          '/admin/',
          '/checkout/',
          '/cart',
          '/profile/',
          '/tetapan/',
          // Tambahan Sprint 1
          '/lp/',
          '/orders',
          '/resit/',
          '/login',
          '/daftar',
          '/reset-password',
          '/checkout',
        ],
      },
    ],
    sitemap: SITEMAP_URL,
  }
}
