// Layout admin (SERVER) — tetapkan manifest PWA admin di peringkat server
// supaya "Add to Home Screen" guna start_url /admin (bukan storefront).
// Override manifest root ("/manifest.json") untuk semua laluan /admin/*.
import type { Metadata } from 'next'
import { AdminShell } from '@/components/admin/admin-shell'

export const metadata: Metadata = {
  manifest: '/admin-manifest.json',
  appleWebApp: { capable: true, title: 'SF Admin', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
