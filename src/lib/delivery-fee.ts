// Satu sumber kiraan kos penghantaran di client — dikongsi Troli (sf-cart) dan
// Checkout supaya jumlah yang dipapar di troli SAMA dengan yang dicaj semasa checkout.
//
// Mencerminkan formula server (api/orders & api/store/guest-order):
//   pickup → 0 ; subtotal >= free_delivery_min → 0 ; selainnya fee zon.
// Sentinel FREE_DELIVERY_OFF (admin matikan toggle percuma) dihormati secara
// eksplisit — had percuma tak pernah tercapai. Lihat lib/shipping.ts.
import { FREE_DELIVERY_OFF } from './shipping'

export function calcDeliveryFee({
  subtotal,
  baseFee,
  freeMin,
  isPickup = false,
}: {
  subtotal: number
  baseFee: number
  freeMin: number
  isPickup?: boolean
}): number {
  if (isPickup) return 0
  if (freeMin < FREE_DELIVERY_OFF && subtotal >= freeMin) return 0
  const fee = Number(baseFee)
  return Number.isFinite(fee) && fee > 0 ? fee : 0
}
