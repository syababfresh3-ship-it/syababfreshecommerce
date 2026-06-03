import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendCapiLead } from '@/lib/meta-capi'
import { upsertCustomer } from '@/lib/customers'

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug || !/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json({ error: 'Tidak sah' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : null
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 120) : null

  if (!name && !phone)
    return NextResponse.json({ error: 'Nama atau telefon diperlukan' }, { status: 400 })

  // Extract browser context for CAPI matching
  const forwarded = request.headers.get('x-forwarded-for')
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : (request.headers.get('x-real-ip') ?? null)
  const userAgent = request.headers.get('user-agent') ?? null
  const cookieHeader = request.headers.get('cookie') ?? ''
  const fbc = cookieHeader.match(/(?:^|;\s*)_fbc=([^;]+)/)?.[1] ?? null
  const fbp = cookieHeader.match(/(?:^|;\s*)_fbp=([^;]+)/)?.[1] ?? null

  const supabase = createAdminClient()

  const { data: page } = await supabase
    .from('landing_pages')
    .select('id, meta_pixel_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!page) return NextResponse.json({ error: 'Halaman tidak dijumpai' }, { status: 404 })

  const { data: lead, error } = await supabase
    .from('landing_page_leads')
    .insert({ page_id: page.id, name: name || null, phone: phone || null, source: source || null })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // CRM master — daftar kenalan dari lead (best-effort)
  if (phone) upsertCustomer({ phone, source: 'lead', name }).catch(() => {})

  sendCapiLead({
    leadId: lead.id,
    pageSlug: slug,
    phone: phone || null,
    name: name || null,
    lpPixelId: (page as any).meta_pixel_id || null,
    clientIp,
    userAgent,
    fbc,
    fbp,
  }).catch(err => console.error('[lead] CAPI error:', err))

  return NextResponse.json({ ok: true })
}
