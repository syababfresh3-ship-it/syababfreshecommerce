import { StoreLayout } from '@/components/layout/store-layout'
import { ProductDetailSkeleton } from '@/components/ui/skeleton'

export default function ProductDetailLoading() {
  return (
    <StoreLayout>
      <ProductDetailSkeleton />
    </StoreLayout>
  )
}
