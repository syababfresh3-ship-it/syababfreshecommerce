import { createAdminClient } from './admin'
import { createClient } from './server'
import { NextResponse } from 'next/server'

export async function requireAdmin() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { supabase: null, forbidden: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { supabase: null, forbidden: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { supabase, forbidden: null }
}
