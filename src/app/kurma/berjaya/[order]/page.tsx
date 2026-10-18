import Link from 'next/link'
import { kurmaPath } from '@/lib/kurma-host'
import { createAdminClient } from '@/lib/supabase/admin'
import { CheckCircle2, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

const rm = (n: unknown) => `RM${Number(n ?? 0).toFixed(2)}`

// Pengesahan tempahan gift (selepas enquiry atau selepas bayar deposit).
export default async function GiftSuccessPage({ params }: { params: Promise<{ order: string }> }) {
  const { order } = await params
  const sb = createAdminClient()
  const { data: o } = await sb.from('gift_orders')
    .select('id, order_number, name, status, payment_status, total, deposit_amount, balance, quantity')
    .eq('order_number', order).maybeSingle()

  if (!o) {
    return <main className="min-h-screen grid place-items-center px-4"><div className="text-center"><p className="text-gray-500">Order not found.</p><Link href={kurmaPath('/')} className="text-[#E11D2A] font-semibold">Back</Link></div></main>
  }

  const depositPaid = o.payment_status === 'deposit_paid' || o.payment_status === 'paid'
  const isEnquiry = o.status === 'enquiry'

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        {depositPaid
          ? <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          : <Clock className="h-14 w-14 text-[#E11D2A] mx-auto" />}
        <h1 className="text-2xl font-black text-gray-900 mt-4">
          {depositPaid ? 'Deposit received!' : isEnquiry ? 'Order received!' : 'Order recorded'}
        </h1>
        <p className="text-gray-500 mt-2">
          {depositPaid
            ? 'Thank you. Our team will start processing your gift and contact you for the next details.'
            : 'Thank you. Our team will contact you to confirm pricing & next steps.'}
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-6 text-left text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Order no.</span><span className="font-mono font-bold text-gray-900">{o.order_number}</span></div>
          <div className="flex justify-between mt-1"><span className="text-gray-500">Name</span><span className="text-gray-900">{o.name}</span></div>
          <div className="flex justify-between mt-1"><span className="text-gray-500">Quantity</span><span className="text-gray-900">{o.quantity} units</span></div>
          <div className="flex justify-between mt-1"><span className="text-gray-500">Estimate</span><span className="text-gray-900 font-semibold">{rm(o.total)}</span></div>
          {depositPaid && <div className="flex justify-between mt-1"><span className="text-gray-500">Balance</span><span className="text-gray-900 font-semibold">{rm(o.balance)}</span></div>}
        </div>

        <Link href={kurmaPath('/')} className="inline-block mt-6 text-[#E11D2A] font-semibold">Design another</Link>
      </div>
    </main>
  )
}
