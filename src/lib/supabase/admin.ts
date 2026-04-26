import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS entirely, for admin server operations
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
// Get it from: Supabase Dashboard → Settings → API → service_role key
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY tidak ditetapkan dalam .env.local\n' +
      'Pergi ke: Supabase Dashboard → Settings → API → service_role key'
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
