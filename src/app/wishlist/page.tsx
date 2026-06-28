// wishlist conversion optimization
import { createClient } from '@/lib/supabase/server'
import { StoreLayout } from '@/components/layout/store-layout'
import { redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import { WishlistCard } from './wishlist-card'

async function getWishlist() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('wishlists')
    .select('product_id, products(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export default async function WishlistPage() {
  const items = await getWishlist()
  if (items === null) redirect('/login?redirect=/wishlist')

  return (
    <StoreLayout>
      <div className="bg-gray-50 min-h-screen px-4 pt-5 pb-28">

        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <Heart className="h-5 w-5 text-red-400 fill-red-400" />
          <h1 className="text-lg font-bold text-gray-900">Senarai Simpan</h1>
          {items.length > 0 && (
            <span className="ml-auto text-xs text-gray-400 font-medium">{items.length} produk</span>
          )}
        </div>

        {items.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-red-50 scale-[1.3] blur-lg" />
              <div className="relative w-16 h-16 rounded-full bg-white shadow-[0_2px_14px_rgba(0,0,0,0.07)] flex items-center justify-center">
                <Heart className="h-7 w-7 text-red-300" />
              </div>
            </div>
            <p className="text-[15px] font-bold text-gray-700 mb-2">
              Belum ada produk disimpan 😢
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mb-7">
              Tekan ikon ❤️ pada produk untuk simpan dan beli kemudian.
            </p>
            <Link
              href="/products"
              className="bg-brand-red-600 text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-[0_4px_16px_rgba(225,29,42,0.42)] active:scale-[0.97] transition-all duration-150"
            >
              Lihat Katalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {items.map((item: any) => (
              <WishlistCard key={item.product_id} product={item.products} />
            ))}
          </div>
        )}
      </div>
    </StoreLayout>
  )
}
