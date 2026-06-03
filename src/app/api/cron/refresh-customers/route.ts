export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { refreshCustomerAggregates } from '@/lib/customers'

// Segar agregat master customer (order_count / total_spend / recency) supaya
// kad stat & segmen CRM tak basi. `upsertCustomer` cuma jaga identiti + sumber +
// recency masa order dibuat; agregat autoritatif dikira semula di sini (hanya
// kira order BUKAN cancelled/refunded → tiada double-count dari order abandoned).
//
// Dipanggil oleh GitHub Actions harian (Vercel Hobby cron hanya 2 slot, dah
// penuh). Jalan SELEPAS reconcile-payments (01:00) supaya order yang baru
// disahkan bayar dikira betul. Dilindungi CRON_SECRET (Bearer).
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    const summary = await refreshCustomerAggregates()
    return Response.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[cron/refresh-customers] failed:', err)
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
