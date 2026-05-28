import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data } = await supabase!
    .from('app_settings')
    .select('value')
    .eq('key', 'store_logo_url')
    .maybeSingle()

  return NextResponse.json({ logo_url: data?.value ?? null })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { logo_url } = await request.json()

  await supabase!
    .from('app_settings')
    .upsert({ key: 'store_logo_url', value: logo_url ?? '', updated_at: new Date().toISOString() })

  revalidateTag('app-settings')
  return NextResponse.json({ ok: true })
}
