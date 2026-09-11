import { createAdminClient } from './admin'
import { createClient } from './server'
import { NextResponse } from 'next/server'

export async function requireAdmin() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { supabase: null, user: null, forbidden: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { supabase: null, user: null, forbidden: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  // `user` ditambah supaya route boleh rekod SIAPA yang buat tindakan (cth
  // approved_by pada kelulusan COD LP). Medan tambahan — pemanggil sedia ada
  // yang hanya ambil { supabase, forbidden } tidak terjejas.
  return { supabase, user, forbidden: null }
}
