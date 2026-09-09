import { Skeleton } from '@/components/ui/skeleton'

// Skeleton neutral untuk semua laluan /admin/* semasa server component sedang
// muat (dulu tiada — page kosong sehingga data tiba). Bentuk generik: bar tajuk
// + 3 blok kandungan; page yang perlu skeleton khusus boleh tambah loading.tsx sendiri.
export default function AdminLoading() {
  return (
    <div className="p-4 md:p-6" aria-busy="true" aria-label="Memuatkan">
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-56 bg-gray-100" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl bg-gray-100" />
        <Skeleton className="h-40 rounded-2xl bg-gray-100" />
        <Skeleton className="h-64 rounded-2xl bg-gray-100" />
      </div>
    </div>
  )
}
