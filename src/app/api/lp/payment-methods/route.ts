import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payment_methods')
    .select('id, label, sublabel')
    .eq('is_active', true)
    .order('sort_order')

  return NextResponse.json(data ?? [])
}
