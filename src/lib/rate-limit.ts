// Rate limiter dalam-memori (sliding window, per-proses). Cukup untuk halang
// enumerasi/spam pada endpoint tanpa auth (cth lookup ikut telefon).
// NOTA: serverless = per-instance, bukan global. Untuk had global merentas
// instance, guna DB/Redis. Ini lapisan pertama yang murah & berkesan.

const hits = new Map<string, number[]>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= max) {
    hits.set(key, arr)
    return false
  }
  arr.push(now)
  hits.set(key, arr)
  // Cegah memory bocor: buang key lama sekali-sekala
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t > windowMs)) hits.delete(k)
  }
  return true
}

// Ambil IP pemanggil dari header proksi (Vercel set x-forwarded-for).
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  return xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}
