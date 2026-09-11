// Kaedah bayaran untuk borang LP. ?slug= → hormati senarai khas LP
// (landing_pages.payment_methods, migration 132); tanpa slug = tetapan sejagat.
import { createAdminClient } from '@/lib/supabase/admin'
import { lpPaymentMethods } from '@/lib/lp-payment'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const slug = new URL(request.url).searchParams.get('slug')
  const methods = await lpPaymentMethods(supabase, slug && /^[a-z0-9-]+$/.test(slug) ? slug : null)
  return NextResponse.json(methods)
}
