import { StoreLayout } from '@/components/layout/store-layout'
import { OrderListSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function OrdersLoading() {
  return (
    <StoreLayout>
      <div className="px-4 pt-4 pb-8">
        <Skeleton className="h-6 w-32 mb-4" />
        <OrderListSkeleton count={4} />
      </div>
    </StoreLayout>
  )
}
