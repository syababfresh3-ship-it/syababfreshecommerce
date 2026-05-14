export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { PromoManager } from './promo-manager'

async function getPromos() {
  const supabase = createClient()
  const { data } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminPromosPage() {
  const promos = await getPromos()

  return (
    <div className="p-4 md:p-6">
      <PromoManager promos={promos as any} />
    </div>
  )
}
