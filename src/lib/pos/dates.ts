// Helper tarikh Malaysia yang PURE (klien + server). Komponen klien POS/admin guna ini, bukan
// lib/daily-summary.ts (yang mengimport push/web-push → modul server 'net' dan gagal di bundle klien).
export const KL_TZ = 'Asia/Kuala_Lumpur'

/** YYYY-MM-DD ikut waktu Malaysia. */
export function klDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Anjak YYYY-MM-DD sebanyak n hari (kalendar, tanpa zon). */
export function shiftDateStr(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
