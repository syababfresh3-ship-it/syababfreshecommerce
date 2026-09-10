// Home — rail produk mendatar ("Paling Laku", "Baru Masuk").
// Server component; kad ialah SfProductCard (client) supaya harga & add-to-cart
// berfungsi sama seperti Katalog. Papar hanya bila ≥ minItems produk.
import type { ComponentProps } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { SfProductCard } from './sf-product-card'
import type { MerchProduct } from '@/lib/merchandising'

type CardProduct = ComponentProps<typeof SfProductCard>['product']

export function SfHomeRail({
  title,
  subtitle,
  href,
  products,
  minItems = 3,
}: {
  title: string
  subtitle?: string
  href: string
  products: MerchProduct[]
  minItems?: number
}) {
  if (products.length < minItems) return null
  return (
    <section aria-label={title} className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold text-gray-900">{title}</h2>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <Link
          href={href}
          className="shrink-0 text-[13px] text-[#E11D2A] font-bold flex items-center gap-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F6F5]"
        >
          Lihat semua <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* -mx-4/px-4 + scroll-px-4: kad scroll hingga tepi skrin, snap sejajar padding.
          Lebar kad ~44vw di mobile (2 kad + hint kad ke-3), tetap 180px di desktop. */}
      <ul className="-mx-4 px-4 flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-proximity scroll-px-4 pb-1">
        {products.map((p) => (
          <li key={p.id} className="snap-start shrink-0 flex w-[44vw] max-w-[190px] sm:w-[180px]">
            {/* Kad menerima Product penuh; select merchandising bawa medan yang kad guna sahaja */}
            <SfProductCard product={p as unknown as CardProduct} />
          </li>
        ))}
      </ul>
    </section>
  )
}
