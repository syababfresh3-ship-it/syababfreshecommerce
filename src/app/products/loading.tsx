import { StoreLayout } from '@/components/layout/store-layout'
import { ProductGridSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function ProductsLoading() {
  return (
    <StoreLayout>
      <div className="px-4 pt-4">
        {/* Search bar skeleton */}
        <Skeleton className="h-10 w-full rounded-2xl" />
        {/* Category chips */}
        <div className="flex gap-2 mt-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
          ))}
        </div>
        {/* Heading + sort */}
        <div className="flex items-center justify-between mt-4 mb-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <ProductGridSkeleton count={6} />
      </div>
    </StoreLayout>
  )
}
