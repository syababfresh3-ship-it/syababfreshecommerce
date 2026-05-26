import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/referrals/lookup?code=XXXX — public, returns referrer first name only
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.toUpperCase().trim()
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('referral_code', code)
    .single()

  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Return first name only — no PII leak
  const firstName = data.full_name?.split(' ')[0] ?? null
  return NextResponse.json({ name: firstName })
}
