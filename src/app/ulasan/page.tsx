import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyReviewToken } from '@/lib/review-token'
import { loadReviewOrder } from '@/lib/review-order'
import { humanWaUrl } from '@/lib/support/constants'
import { ReviewForm } from './review-form'

// /ulasan?t=<token> — beri ulasan tanpa login (pautan dari email selepas order sampai)
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Beri Ulasan | SyababFresh', robots: { index: false, follow: false } }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <Link href="/" className="text-lg font-black text-gray-900 tracking-tight">SyababFresh</Link>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

export default async function UlasanPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  const tok = verifyReviewToken(t)
  if (!tok) {
    return (
      <Shell>
        <h1 className="text-xl font-black text-gray-900">Pautan tidak sah atau telah tamat</h1>
        <p className="text-sm text-gray-600 mt-2">Pautan ulasan sah selama 45 hari selepas order sampai. Kalau anda mahu beri ulasan, hubungi kami dan kami hantar pautan baru.</p>
        <a href={humanWaUrl('Hai SyababFresh, saya nak beri ulasan tapi pautan tak sah.')} className="inline-block mt-4 text-sm font-bold text-gray-900 underline">Hubungi kami di WhatsApp</a>
      </Shell>
    )
  }

  const order = await loadReviewOrder(createAdminClient(), tok.source, tok.orderId)
  if (!order) {
    return <Shell><h1 className="text-xl font-black text-gray-900">Order tidak dijumpai</h1></Shell>
  }
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return <Shell><h1 className="text-xl font-black text-gray-900">Order ini telah dibatalkan</h1><p className="text-sm text-gray-600 mt-2">Tiada ulasan diperlukan untuk order {order.order_number}.</p></Shell>
  }

  return (
    <Shell>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Order {order.order_number}</p>
      <h1 className="text-xl font-black text-gray-900 mt-1">Hai {order.name.split(' ')[0]}, macam mana buah anda?</h1>
      <p className="text-sm text-gray-600 mt-2">Ulasan anda dipaparkan di page produk sebagai <strong>{shortName(order.name)}</strong> dengan tanda &quot;Pembeli disahkan&quot;. Ikhlas sahaja, termasuk kalau ada yang kurang memuaskan.</p>
      <ReviewForm token={t!} items={order.items} existing={order.existing} />
    </Shell>
  )
}

function shortName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? 'Pelanggan'
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`
}
