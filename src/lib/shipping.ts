// Konstanta penghantaran — selamat diimport oleh client & server (tiada
// kebergantungan server-only seperti app-settings.ts).

// Sentinel: bila admin matikan toggle "Penghantaran Percuma", free_delivery_min
// disimpan sebagai nilai besar ini supaya tiada had percuma sebenar tercapai.
// Pengguna nilai ini patut menyemak `freeDeliveryActive()` dahulu sebelum
// memaparkan nudge/badge "PERCUMA".
export const FREE_DELIVERY_OFF = 99999

// True bila penghantaran percuma sebenarnya diaktifkan (had munasabah, bukan sentinel).
export const freeDeliveryActive = (min: number) => min > 0 && min < FREE_DELIVERY_OFF
