'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

const pageLabels: Record<string, string> = {
  '/admin':               'Dashboard',
  '/admin/fulfillment':   'Fulfillment',
  '/admin/orders':        'Pesanan',
  '/admin/inventory':     'Inventori',
  '/admin/refunds':       'Refund',
  '/admin/products':      'Produk',
  '/admin/products/new':  'Produk Baru',
  '/admin/categories':    'Kategori',
  '/admin/promos':        'Promosi',
  '/admin/banners':       'Banner',
  '/admin/notifications': 'Notifikasi',
  '/admin/customers':     'Pelanggan',
  '/admin/analytics':     'Analitik',
  '/admin/delivery':      'Kawasan Hantar',
}

function getLabel(pathname: string) {
  if (pageLabels[pathname]) return pageLabels[pathname]
  // products/[id] — edit page
  if (pathname.startsWith('/admin/products/')) return 'Edit Produk'
  // orders/[id]
  if (pathname.startsWith('/admin/orders/')) return 'Detail Pesanan'
  // customers/[id]
  if (pathname.startsWith('/admin/customers/')) return 'Detail Pelanggan'
  return 'Admin'
}

function getParent(pathname: string): { label: string; href: string } | null {
  if (pathname.startsWith('/admin/products/') && pathname !== '/admin/products') {
    return { label: 'Produk', href: '/admin/products' }
  }
  if (pathname.startsWith('/admin/orders/') && pathname !== '/admin/orders') {
    return { label: 'Pesanan', href: '/admin/orders' }
  }
  if (pathname.startsWith('/admin/customers/') && pathname !== '/admin/customers') {
    return { label: 'Pelanggan', href: '/admin/customers' }
  }
  return null
}

export function AdminHeader() {
  const pathname = usePathname()
  const label = getLabel(pathname)
  const parent = getParent(pathname)

  const now = new Date()
  const dateStr = now.toLocaleDateString('ms-MY', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {parent ? (
          <>
            <Link href={parent.href} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              {parent.label}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
          </>
        ) : null}
        <span className="text-sm font-semibold text-gray-800 truncate">{label}</span>
      </div>

      {/* Date */}
      <span className="text-xs text-gray-400 shrink-0">{dateStr}</span>
    </header>
  )
}
