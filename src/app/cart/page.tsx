// Redesign v2 — Troli (storefront). Lihat SfCart untuk UI + logik.
import { SfShell } from '@/components/storev2/sf-shell'
import { SfCart } from '@/components/storev2/sf-cart'

export default function CartPage() {
  return (
    <SfShell>
      <SfCart />
    </SfShell>
  )
}
