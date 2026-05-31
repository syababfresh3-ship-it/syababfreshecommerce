

























import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
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
};

export default nextConfig;
