// Semak lajur lp_guest_orders.staff_name (migration 162) wujud — supaya kod boleh deploy
// SEBELUM atau SELEPAS migration tanpa pecah (PostgREST tolak select/insert lajur yang tiada).
// Keputusan dicache 5 minit setiap instance fungsi; selepas migration, cache tamat sendiri.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

let cache: { ok: boolean; at: number } | null = null
const TTL_MS = 5 * 60 * 1000

export async function hasLpStaffColumn(sb: SB): Promise<boolean> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ok
  const { error } = await sb.from('lp_guest_orders').select('staff_name').limit(0)
  const ok = !error
  cache = { ok, at: Date.now() }
  return ok
}
