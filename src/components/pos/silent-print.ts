// Cetak resit "senyap": page resit (?print=) dimuat dalam iframe 1px yang tersembunyi dan AutoPrint di dalamnya
// panggil window.print() — skrin Sell kekal, pelanggan tak nampak page resit terbuka dalam tab baharu.
// Dialog cetak Chrome masih muncul KECUALI Chrome dilancarkan dengan --kiosk-printing (cetak terus ke pencetak
// lalai) — langkah pemilik di PC kaunter; laci tunai dibuka oleh tetapan driver pencetak ("open drawer before print").
// Same-origin (CSP frame-ancestors 'self'). Iframe dibuang selepas afterprint atau 90s.
export function printReceiptSilently(token: string, paper: 58 | 80): void {
  if (typeof document === 'undefined' || !token) return
  const f = document.createElement('iframe')
  f.setAttribute('aria-hidden', 'true')
  f.setAttribute('title', 'receipt-print')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none'
  f.src = `/pos/resit/${encodeURIComponent(token)}?print=${paper}`
  let done = false
  const cleanup = () => { if (done) return; done = true; try { f.remove() } catch { /* abaikan */ } }
  f.addEventListener('load', () => {
    try { f.contentWindow?.addEventListener('afterprint', () => setTimeout(cleanup, 500)) } catch { /* cross-origin tak dijangka */ }
  })
  setTimeout(cleanup, 90_000)
  document.body.appendChild(f)
}
