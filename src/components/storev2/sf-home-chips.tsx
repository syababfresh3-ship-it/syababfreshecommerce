// Home — baris chip kategori (scroll mendatar) terus di bawah greeting.
// Server component: hanya pautan ke /kategori/<slug>. Papar bila ≥ minItems.
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { CategoryChip } from '@/lib/merchandising'

const CHIP =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border bg-white px-3.5 py-1.5 ' +
  'text-[12.5px] font-semibold active:scale-95 transition ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F6F5]'

export function SfHomeChips({ chips, minItems = 3 }: { chips: CategoryChip[]; minItems?: number }) {
  if (chips.length < minItems) return null
  return (
    // -mx-4/px-4: scroll hingga ke tepi skrin, chip pertama sejajar padding page
    <nav aria-label="Kategori" className="-mx-4 px-4 overflow-x-auto no-scrollbar">
      <ul className="flex w-max gap-2 pr-4">
        {chips.map((c) => (
          <li key={c.id}>
            <Link href={`/kategori/${c.slug}`} className={`${CHIP} border-gray-200 text-gray-800`}>
              {c.name}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/products" className={`${CHIP} border-gray-200 text-gray-500`}>
            Semua <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
