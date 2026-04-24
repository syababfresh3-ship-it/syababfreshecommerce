import { createClient } from '@/lib/supabase/server'
import { PromoManager } from './promo-manager'

async function getPromos() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminPromosPage() {
  const promos = await getPromos()

  return (
    <div className="p-6">
      <PromoManager promos={promos as any} />
    </div>
  )
}
