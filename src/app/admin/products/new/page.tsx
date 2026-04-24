import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '../product-form'

async function getCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  return data ?? []
}

export default async function NewProductPage() {
  const categories = await getCategories()

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Tambah Produk</h1>
      <ProductForm categories={categories} />
    </div>
  )
}
