// ============================================================
// Peraturan peralihan status order (storefront `orders` & `lp_guest_orders`).
//
// Audit §4: dulu admin boleh tukar apa-apa → apa-apa (cancelled → delivered,
// delivered → pending) dan kesan sampingan (mata, email) terpicu semula.
// Pragmatik: staf masih boleh undur antara confirmed/preparing/delivering
// (tersilap klik), tetapi:
//   - refunded  → tiada apa-apa
//   - cancelled → hanya refunded (order dibayar lalu dibatalkan)
//   - delivered → hanya refunded
//   - → pending hanya dari pending (tak boleh "buka semula")
//   - → refunded hanya dari delivered atau cancelled
// ============================================================

export const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled', 'refunded'] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export function canTransition(from: string | null | undefined, to: string): boolean {
  if (!from || from === to) return true
  if (from === 'refunded') return false
  if (from === 'cancelled') return to === 'refunded'
  if (from === 'delivered') return to === 'refunded'
  if (to === 'pending') return false
  if (to === 'refunded') return false // hanya dari delivered/cancelled (ditangani di atas)
  return true
}

export function transitionError(from: string | null | undefined, to: string): string {
  return `Status tidak boleh ditukar dari "${from ?? '?'}" ke "${to}"`
}
