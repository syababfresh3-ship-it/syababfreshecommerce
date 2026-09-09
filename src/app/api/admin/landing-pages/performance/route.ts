import { requireAdmin } from '@/lib/supabase/require-admin'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { NextResponse } from 'next/server'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  // fetchAll: PostgREST cap 1000 baris/permintaan — dulu lp_guest_orders/leads tanpa
  // .range() diam-diam terpotong → revenue/conversion LP terkurang. Bentuk hasil kekal.
  type LpOrderRow = { page_id: string; total: number | null; status: string; payment_method: string | null; payment_status: string | null; created_at: string }
  type LeadRow = { page_id: string; created_at: string }
  const [pagesRes, orders, leads] = await Promise.all([
    supabase!.from('landing_pages')
      .select('id, title, slug, is_active, view_count, created_at')
      .order('created_at', { ascending: false }),
    fetchAll<LpOrderRow>((f, t) =>
      supabase!.from('lp_guest_orders')
        .select('page_id, total, status, payment_method, payment_status, created_at')
        .order('id').range(f, t),
      'lp-performance:orders'),
    fetchAll<LeadRow>((f, t) =>
      supabase!.from('landing_page_leads')
        .select('page_id, created_at')
        .order('id').range(f, t),
      'lp-performance:leads'),
  ])

  const pages = pagesRes.data ?? []

  // Aggregate per page
  const result = pages.map(page => {
    const pageOrders = orders.filter(o => o.page_id === page.id)
    const pageLeads = leads.filter(l => l.page_id === page.id)

    const totalOrders = pageOrders.length
    // "Sah" (pipeline) — order yang admin/ sistem dah sahkan; buang pending, cancelled, refunded.
    const ACTIVE = ['confirmed', 'preparing', 'delivering', 'delivered']
    const activeOrders = pageOrders.filter(o => ACTIVE.includes(o.status))
    const confirmedOrders = activeOrders.length
    const revenue = activeOrders.reduce((sum, o) => sum + Number(o.total), 0)
    // "Dah bayar" — wang sebenar diterima: online payment_status='paid', atau COD/bank dah delivered.
    const revenuePaid = activeOrders
      .filter(o => o.payment_status === 'paid' || o.status === 'delivered')
      .reduce((sum, o) => sum + Number(o.total), 0)
    const totalLeads = pageLeads.length
    const views = page.view_count ?? 0
    const aov = confirmedOrders > 0 ? revenue / confirmedOrders : 0
    const orderRate = views > 0 ? (totalOrders / views) * 100 : 0
    const leadRate = views > 0 ? (totalLeads / views) * 100 : 0

    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      is_active: page.is_active,
      created_at: page.created_at,
      views,
      leads: totalLeads,
      orders: totalOrders,
      confirmed_orders: confirmedOrders,
      revenue,
      revenue_paid: revenuePaid,
      aov,
      order_rate: orderRate,
      lead_rate: leadRate,
    }
  })

  return NextResponse.json(result)
}
