export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <Skeleton className="aspect-square rounded-none" />
      <div className="p-3">
        {/* name — 2 lines */}
        <Skeleton className="h-3.5 w-full mb-1" />
        <Skeleton className="h-3.5 w-2/3 mb-2" />
        {/* price */}
        <Skeleton className="h-4 w-1/2 mb-2" />
        {/* unit + cart btn row */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/2" />
      <div className="flex justify-between items-center pt-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square rounded-none" />
      <div className="px-4 pt-4 space-y-4">
        <Skeleton className="h-3.5 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  )
}
