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
      <div className="flex justify-end mb-3">
        <a href="/admin/promos/usage" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-100">
          📊 Penggunaan Kupon & Points
        </a>
      </div>
      <PromoManager promos={promos as any} />
    </div>
  )
}
