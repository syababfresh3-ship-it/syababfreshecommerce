export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSegment } from '../customers/segment-utils'
import { ContactsClient } from './contacts-client'

// Channel dari sumber: store/tiktok/web = beli macam kedai, lp = landing page.
function channelFromSources(sources: string[]): 'both' | 'lp_only' | 'store_only' | 'none' {
  const store = sources.some(s => s === 'store' || s === 'tiktok' || s === 'web')
  const lp = sources.includes('lp')
  if (store && lp) return 'both'
  if (lp) return 'lp_only'
  if (store) return 'store_only'
  return 'none'
}

async function getContacts() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('customers')
    .select('id, name, phone_norm, email, sources, tags, is_reseller, order_count, total_spend, last_order_at, first_seen_at, consent_wa, consent_email')
    .order('total_spend', { ascending: false })
    .limit(5000)

  return (data ?? []).map(c => ({
    ...c,
    segment: getSegment({
      totalSpend: Number(c.total_spend || 0),
      createdAt: c.first_seen_at ?? c.last_order_at ?? new Date().toISOString(),
      lastOrderAt: c.last_order_at,
      orderCount: c.order_count,
    }),
    channel: channelFromSources(c.sources ?? []),
  }))
}

export default async function ContactsPage() {
  const contacts = await getContacts()
  return (
    <div className="p-4 md:p-6">
      <ContactsClient contacts={contacts as any} />
    </div>
  )
}
