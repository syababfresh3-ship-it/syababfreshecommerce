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

export default async function ResellersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [resellers, sp] = await Promise.all([getResellers(), searchParams])
  // ?status=pending — pautan dari e-mel permohonan LP borong
  const initialFilter = ['pending', 'active', 'suspended'].includes(sp.status ?? '') ? (sp.status as string) : 'all'
  return (
    <div className="p-4 md:p-6">
      <ResellersClient initial={resellers as any} initialFilter={initialFilter} />
    </div>
  )
}
