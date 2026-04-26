export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { CustomersClient } from './customers-client'

async function getCustomers() {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*, loyalty_tiers(name)')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminCustomersPage() {
  const customers = await getCustomers()

  return (
    <div className="p-6">
      <CustomersClient customers={customers as any} />
    </div>
  )
}
