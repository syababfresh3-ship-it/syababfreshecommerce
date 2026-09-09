import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// Nama penulis ulasan.
//
// product_reviews.user_id merujuk auth.users, BUKAN public.profiles — jadi
// embed PostgREST `profiles(full_name)` gagal (PGRST200) dan senarai ulasan
// jadi kosong. Helper ini ambil nama secara berasingan (service role: profiles
// dilindungi RLS) dan kembalikan bentuk `profiles: { full_name }` yang sama
// supaya komponen sedia ada tak perlu diubah.
// ============================================================

export interface ReviewWithName {
  id: string
  rating: number
  comment: string | null
  created_at: string
  profiles?: { full_name: string | null }
}

export async function attachReviewerNames<T extends { user_id: string }>(
  rows: T[],
): Promise<(Omit<T, 'user_id'> & { profiles: { full_name: string | null } })[]> {
  const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
  const nameById = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data } = await createAdminClient().from('profiles').select('id, full_name').in('id', userIds)
    for (const p of data ?? []) nameById.set(p.id, p.full_name)
  }
  return rows.map(r => {
    const { user_id, ...rest } = r
    return { ...rest, profiles: { full_name: nameById.get(user_id) ?? null } }
  })
}
