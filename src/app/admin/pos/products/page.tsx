import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PosProductsClient } from './products-client'

export const metadata: Metadata = { title: 'POS Products' }

// Jadual produk × varian dengan lajur tetapan POS → lebar penuh (AGENTS.md)
export default function AdminPosProductsPage() {
  return (
    <div className="p-4 md:p-6">
      {/* Suspense: klien baca ?page= via useSearchParams */}
      <Suspense fallback={null}>
        <PosProductsClient />
      </Suspense>
    </div>
  )
}
