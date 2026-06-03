export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { ResellersClient } from './resellers-client'

async function getResellers() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('resellers')
    .select('*, customers(id, name, phone_norm, email, order_count, total_spend)')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function ResellersPage() {
  const resellers = await getResellers()
  return (
    <div className="p-4 md:p-6">
      <ResellersClient initial={resellers as any} />
    </div>
  )
}
