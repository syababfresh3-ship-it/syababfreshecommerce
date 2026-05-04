import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StoreLayout } from '@/components/layout/store-layout'
import { AddressList } from '../addresses'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Alamat Penghantaran',
  robots: { index: false, follow: false },
}

async function getData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: addresses } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return { userId: user.id, addresses: addresses ?? [] }
}

export default async function AddressesPage() {
  const data = await getData()
  if (!data) redirect('/login?redirect=/profile/addresses')

  return (
    <StoreLayout>
      <div className="bg-gray-50 min-h-screen">

        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <Link href="/profile" className="p-1.5 -ml-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <h1 className="text-sm font-bold text-gray-900">Alamat Penghantaran</h1>
        </div>

        <div className="px-4 py-4">
          <AddressList addresses={data.addresses} userId={data.userId} />
        </div>

      </div>
    </StoreLayout>
  )
}
