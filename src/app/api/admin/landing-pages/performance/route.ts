import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const [pagesRes, ordersRes, leadsRes] = await Promise.all([
    supabase!.from('landing_pages')
      .select('id, title, slug, is_active, view_count, created_at')
      .order('created_at', { ascending: false }),
    supabase!.from('lp_guest_orders')
      .select('page_id, total, status, created_at'),
    supabase!.from('landing_page_leads')
      .select('page_id, created_at'),
  ])

  const pages = pagesRes.data ?? []
  const orders = ordersRes.data ?? []
  const leads = leadsRes.data ?? []

  // Aggregate per page
  const result = pages.map(page => {
    const pageOrders = orders.filter(o => o.page_id === page.id)
    const pageLeads = leads.filter(l => l.page_id === page.id)

    const totalOrders = pageOrders.length
    const confirmedOrders = pageOrders.filter(o => o.status === 'confirmed' || o.status === 'preparing' || o.status === 'delivering' || o.status === 'delivered').length
    const revenue = pageOrders
      .filter(o => o.status !== 'cancelled')
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
      aov,
      order_rate: orderRate,
      lead_rate: leadRate,
    }
  })

  return NextResponse.json(result)
}
