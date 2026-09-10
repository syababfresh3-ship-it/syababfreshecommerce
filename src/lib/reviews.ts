import { createAdminClient } from '@/lib/supabase/admin'
import { shortReviewerName } from '@/lib/lp-live'

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

export async function attachReviewerNames<T extends { user_id: string | null; guest_name?: string | null }>(
  rows: T[],
): Promise<(Omit<T, 'user_id' | 'guest_name'> & { profiles: { full_name: string | null } })[]> {
  const userIds = [...new Set(rows.map(r => r.user_id).filter((v): v is string => !!v))]
  const nameById = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data } = await createAdminClient().from('profiles').select('id, full_name').in('id', userIds)
    for (const p of data ?? []) nameById.set(p.id, p.full_name)
  }
  return rows.map(r => {
    // guest_name dibuang dari output — nama penuh tetamu tak boleh sampai ke browser (payload RSC)
    const { user_id, guest_name, ...rest } = r
    // Tetamu (migration 126): nama dari order, dipendekkan ("Nurul A.") — tak dedah nama penuh
    const name = (user_id ? nameById.get(user_id) : null) ?? (guest_name ? shortReviewerName(guest_name) : null)
    return { ...rest, profiles: { full_name: name } }
  })
}
