import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug || !/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json({ ok: false }, { status: 400 })

  const supabase = createAdminClient()
  await supabase.rpc('increment_lp_view_count', { p_slug: slug })

  return NextResponse.json({ ok: true })
}
