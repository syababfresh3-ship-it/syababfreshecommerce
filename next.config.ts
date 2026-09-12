

























import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Matikan butang dev indicator ("N" terapung) yang menutupi ikon bottom-nav masa dev.
  devIndicators: false,
  // Pastikan fail SOP markdown dibundle untuk halaman /admin/sop di production
  outputFileTracingIncludes: {
    '/admin/sop': ['./docs/SOP-admin.md'],
  },
  turbopack: {
    resolveAlias: {
      '@supabase/auth-js': '@supabase/auth-js/dist/module/index.js',
    },
  },
  images: {
    // Optimize imej melalui Supabase Storage transformation (bukan Vercel) —
    // jimat kuota Image Optimization + Edge Requests Vercel.
    loader: 'custom',
    loaderFile: './src/lib/supabase-image-loader.ts',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/**',
      },
    ],
  },
  // Jangan bocorkan "X-Powered-By: Next.js" kepada pengimbas.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Header keselamatan asas untuk SEMUA laluan (§0.13 audit Sep 2026).
        //
        // CSP di sini SENGAJA minimum — hanya tiga arahan yang TIDAK menyentuh
        // skrip. Sebabnya: page LP menyuntik <script> inline dari `html_content`
        // (lihat LpHtmlScripts), dan `script-src` berasaskan nonce memerlukan
        // dynamic rendering — itu akan membunuh static/ISR dan memecahkan LP.
        // Tiga arahan ini tutup clickjacking + suntikan <base>/<object> tanpa
        // sebarang risiko kepada skrip sedia ada.
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
          // Sandaran untuk browser lama yang belum faham frame-ancestors.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Berpasangan dengan sniffing magic-bytes di lib/file-guard.ts:
          // halang browser meneka semula jenis fail yang kita simpan.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Tiada satu pun API ini dipakai storefront — matikan terus.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // 1 tahun. `includeSubDomains`/`preload` SENGAJA ditinggalkan buat masa
          // ini — kedua-duanya sukar dipulihkan dan menyentuh subdomain lain.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // AI support pelanggan kini di syababfresh-app (data pos/tracking ada di sana).
      // Alih sebarang lawatan ke /bantuan storefront → app. 307 (sementara) supaya
      // mudah dipulihkan kalau perlu balik ke page tempatan.
      {
        source: '/bantuan',
        destination: 'https://manage.syababfresh.my/bantuan',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
