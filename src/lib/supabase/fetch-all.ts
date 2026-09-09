// Supabase/PostgREST hadkan 1000 baris SETIAP permintaan (max-rows). Select tanpa
// .range() diam-diam terpotong pada 1000 → agregat (order_count, total_spend,
// revenue LP) jadi salah TANPA ralat. Helper ini muat semua baris dalam ketulan
// 1000 sehingga halaman pendek menandakan tamat.
//
// Peraturan: sentiasa sertakan .order(...) deterministik dalam builder (cth
// .order('id') atau .order('created_at').order('id')) supaya halaman tidak
// bertindih/terlepas. Ralat → berhenti & pulang apa yang ada (perangai sama
// dengan `data ?? []` yang digantikannya), tetapi dilog supaya tidak tersembunyi.
//
// Dipakai: lib/customers.ts, admin/customers, admin/analytics, LP performance,
// export-orders.

const CHUNK = 1000

type PageResult = { data: unknown; error: unknown }

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<PageResult>,
  label = 'fetchAll',
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await build(from, from + CHUNK - 1)
    if (error) {
      const msg = (error as { message?: string })?.message ?? String(error)
      console.error(`[${label}] rows ${from}-${from + CHUNK - 1} failed:`, msg)
      break
    }
    const rows = Array.isArray(data) ? (data as T[]) : []
    if (rows.length === 0) break
    out.push(...rows)
    if (rows.length < CHUNK) break
  }
  return out
}
