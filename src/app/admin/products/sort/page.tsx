export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SortList } from '../sort-list'

export default async function ProductSortPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, is_active')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/products" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Urus Urutan Product</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5 ml-7">
        Seret dan lepas untuk susun semula. Klik <strong>Save Urutan</strong> bila selesai.
      </p>

      <div className="max-w-md">
        <SortList products={data ?? []} />
      </div>
    </div>
  )
}
