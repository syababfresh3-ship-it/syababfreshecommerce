// Penapis senarai Orders admin — DIKONGSI antara page /admin/orders (paparan)
// dan /api/admin/export-orders (CSV) supaya eksport ikut tapisan yang sama persis.
// Logik dipindahkan seperti asal dari page; jangan ubah semantik satu tanpa
// menyemak pengguna yang satu lagi.

export type Bounds = { gte?: string; lt?: string; lte?: string }

// Param URL yang membentuk tapisan senarai Orders (juga dihantar ke export).
export const ORDER_FILTER_KEYS = ['status', 'q', 'date', 'lp', 'from', 'to', 'pay', 'staff'] as const
export type OrderFilterKey = (typeof ORDER_FILTER_KEYS)[number]
export type OrderFilterParams = Partial<Record<OrderFilterKey, string>>

// Preset tarikh (?date=hari-ini|semalam|7-hari|bulan-ini). Waktu server (perangai asal).
export function dateRange(preset?: string): Bounds {
  if (!preset) return {}
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === 'hari-ini') {
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    return { gte: today.toISOString(), lt: tomorrow.toISOString() }
  }
  if (preset === 'semalam') {
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    return { gte: yesterday.toISOString(), lt: today.toISOString() }
  }
  if (preset === '7-hari') {
    const week = new Date(today); week.setDate(today.getDate() - 6)
    return { gte: week.toISOString() }
  }
  if (preset === 'bulan-ini') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return { gte: monthStart.toISOString() }
  }
  return {}
}

// Julat custom (from/to = YYYY-MM-DD, MYT; 'to' inklusif hingga 23:59:59) mengatasi preset.
export function resolveBounds(p: { date?: string; from?: string; to?: string }): Bounds {
  const { date, from, to } = p
  if (from || to) {
    return {
      ...(from ? { gte: `${from}T00:00:00+08:00` } : {}),
      ...(to ? { lte: `${to}T23:59:59+08:00` } : {}),
    }
  }
  return dateRange(date)
}

// Sumber (?lp=): 'storefront' = kedai sahaja; 'manual' = keyin manual sahaja;
// UUID = LP tertentu sahaja (kedai tiada attribution); kosong = dua-dua.
export function resolveSource(lp?: string): { manualOnly: boolean; storefrontOnly: boolean; lpPageId: string | undefined } {
  const manualOnly = lp === 'manual'
  const storefrontOnly = lp === 'storefront'
  const lpPageId = lp && !storefrontOnly && !manualOnly ? lp : undefined
  return { manualOnly, storefrontOnly, lpPageId }
}

// Sorok order online (FPX/e-wallet) yang belum bayar — customer buka page bayaran
// tapi tak bayar. COD/bank sentiasa tunjuk (tiada bayaran online untuk ditunggu).
// 'refunded' = dah bayar dulu kemudian dipulangkan → kekal papar. Polisi sama
// untuk storefront & LP.
export function isPaidOrOffline(o: { payment_method?: string | null; payment_status?: string | null }): boolean {
  return ['fpx', 'ewallet'].includes(o.payment_method ?? '')
    ? ['paid', 'refunded'].includes(o.payment_status ?? '')
    : true
}

// Order LP yang diurus team sale sendiri: Quick Order (source 'whatsapp*') atau
// Inbox WA / CRM ('crm'/'manual') — COD sudah disahkan dengan customer.
export function isTeamManagedSrc(s: unknown): boolean {
  return typeof s === 'string' && (s.startsWith('whatsapp') || s === 'crm' || s === 'manual')
}

// Kelaskan `source` LP. Quick Order hantar 'whatsapp' atau 'whatsapp-<staf>' → manual;
// nama staf disimpan dalam source sebagai 'whatsapp-<nama>'.
export function classifyLpSource(source: unknown): {
  isReseller: boolean; isStoreGuest: boolean; isManual: boolean; staffName: string | null
} {
  const isReseller = source === 'reseller'
  const isStoreGuest = source === 'store-guest'
  const isManual = !isReseller && !isStoreGuest && typeof source === 'string'
    && (source.startsWith('whatsapp') || source === 'manual')
  const staffName = isManual && typeof source === 'string' && source.startsWith('whatsapp-')
    ? source.slice('whatsapp-'.length) : null
  return { isReseller, isStoreGuest, isManual, staffName }
}

// Carian (?q=): padan no. order / nama (case-insensitive) atau telefon (substring tepat).
export function matchesSearch(q: string, f: { orderNumber?: string | null; name?: string | null; phone?: string | null }): boolean {
  const lower = q.toLowerCase()
  return !!(
    f.orderNumber?.toLowerCase().includes(lower) ||
    f.name?.toLowerCase().includes(lower) ||
    f.phone?.includes(q)
  )
}

// Tapisan bayaran (?pay=unpaid|paid). Online belum-bayar dah disorok di atas,
// jadi 'unpaid' di sini = COD/bank transfer yang belum dikutip.
export function matchesPay(pay: string | undefined, paymentStatus: string | null | undefined): boolean {
  if (pay === 'unpaid') return paymentStatus === 'unpaid'
  if (pay === 'paid') return paymentStatus === 'paid'
  return true
}

// Bina query string (dengan '?') dari tapisan semasa — hanya param yang diisi.
export function buildOrderFilterQuery(p: OrderFilterParams): string {
  const sp = new URLSearchParams()
  for (const k of ORDER_FILTER_KEYS) {
    const v = p[k]
    if (v) sp.set(k, v)
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
