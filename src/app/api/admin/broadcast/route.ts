import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'

export interface Recipient { id: string; full_name: string | null; phone: string }

async function getRecipients(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdmin>>['supabase']>,
  filter: string,
  states: string[],
  activityDays: number,
  activityType: string,
  manualIds: string[],
): Promise<Recipient[]> {
  const base = supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('whatsapp_optin', true)
    .not('phone', 'is', null)
    .neq('phone', '')

  if (filter === 'manual') {
    if (!manualIds.length) return []
    const { data } = await base.in('id', manualIds)
    return (data ?? []) as Recipient[]
  }

  if (filter === 'state' && states.length > 0) {
    // Get profile IDs that have an address in the selected states
    const { data: addrs } = await supabase
      .from('addresses')
      .select('user_id')
      .in('state', states)
    const userIds = [...new Set((addrs ?? []).map((a: any) => a.user_id))]
    if (!userIds.length) return []
    const { data } = await base.in('id', userIds)
    return (data ?? []) as Recipient[]
  }

  if (filter === 'activity') {
    const { data: allProfiles } = await base
    if (!allProfiles?.length) return []

    const userIds = allProfiles.map((p: any) => p.id)
    const { data: orders } = await supabase
      .from('orders')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .in('status', ['confirmed', 'preparing', 'delivering', 'delivered'])
      .order('created_at', { ascending: false })

    const lastOrderMap = new Map<string, Date>()
    for (const o of orders ?? []) {
      if (!lastOrderMap.has(o.user_id)) {
        lastOrderMap.set(o.user_id, new Date(o.created_at))
      }
    }

    const cutoff = new Date(Date.now() - activityDays * 86400_000)

    return (allProfiles as Recipient[]).filter(p => {
      const last = lastOrderMap.get(p.id)
      if (activityType === 'never') return !last
      if (activityType === 'inactive') return !last || last < cutoff
      if (activityType === 'active') return last && last >= cutoff
      return true
    })
  }

  // Default: all
  const { data } = await base
  return (data ?? []) as Recipient[]
}

export async function GET(req: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const url = new URL(req.url)
  const filter = url.searchParams.get('filter') ?? 'all'
  const states = url.searchParams.get('states')?.split(',').filter(Boolean) ?? []
  const activityDays = parseInt(url.searchParams.get('days') ?? '30', 10)
  const activityType = url.searchParams.get('activityType') ?? 'inactive'
  const manualIds = url.searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  const preview = url.searchParams.get('preview') === '1'

  const recipients = await getRecipients(supabase!, filter, states, activityDays, activityType, manualIds)

  // For recipient picker: return full list
  if (preview) {
    return NextResponse.json({ recipients, count: recipients.length })
  }

  return NextResponse.json({ count: recipients.length })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const { message, filter = 'all', states = [], activityDays = 30, activityType = 'inactive', manualIds = [] } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const recipients = await getRecipients(supabase!, filter, states, activityDays, activityType, manualIds)

  if (!recipients.length) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 })
  }

  let sent = 0
  let failed = 0

  for (const profile of recipients) {
    const personalised = message.replace(/\{nama\}/gi, profile.full_name ?? 'Pelanggan')
    const result = await sendWhatsApp(profile.phone!, personalised)
    if ((result as any).success || (result as any).skipped) sent++
    else failed++
    await new Promise(r => setTimeout(r, 200))
  }

  return NextResponse.json({ sent, failed, total: recipients.length })
}
