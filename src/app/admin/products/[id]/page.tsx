import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '../product-form'
import { notFound } from 'next/navigation'

async function getProduct(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

async function getCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  return data ?? []
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [product, categories] = await Promise.all([getProduct(id), getCategories()])

  if (!product) notFound()

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Edit Produk</h1>
      <ProductForm categories={categories} product={product} />
    </div>
  )
}
