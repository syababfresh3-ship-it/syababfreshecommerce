// ============================================================
// chip-methods — peta payment_method (storefront) → payment_method_whitelist CHIP.
// Nilai DISAHKAN terhadap API CHIP live (purchase 201). Nota: 'card' BUKAN nilai
// sah — kad guna ['visa','mastercard']. FPX B2B = 'fpx_b2b1'. DuitNow = 'duitnow_qr'.
//
// CHIP_METHODS = kaedah yang diproses online via CHIP (bukan COD/pindahan bank).
// CHIP_WHITELIST = untuk kaedah yang whitelistnya disahkan → halaman CHIP terus
// tunjuk kaedah itu sahaja. Kaedah tanpa entry (cth ewallet) → whitelist tak
// dihantar (CHIP tunjuk semua) — selamat, elak hantar nilai belum disahkan.
// ============================================================

export const CHIP_WHITELIST: Record<string, string[]> = {
  fpx: ["fpx"],
  fpx_b2b: ["fpx_b2b1"],
  duitnow: ["duitnow_qr"],
  card: ["visa", "mastercard"],
};

// Kaedah yang pergi ke CHIP (online). ewallet dikekalkan untuk keserasian lama.
export const CHIP_METHODS = new Set<string>([
  "fpx",
  "fpx_b2b",
  "duitnow",
  "card",
  "ewallet",
]);

export function isChipMethod(method: string | null | undefined): boolean {
  return !!method && CHIP_METHODS.has(method);
}
