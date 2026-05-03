import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Called right after signup: POST { ref_code }
// Creates the referral row + awards referee 50 pts as welcome bonus
export async function POST(request: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ref_code } = await request.json()
  if (!ref_code || typeof ref_code !== 'string') {
    return NextResponse.json({ error: 'ref_code required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Look up referrer by code
  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', ref_code.toUpperCase())
    .single()

  if (!referrer) return NextResponse.json({ error: 'Kod tidak sah' }, { status: 404 })
  if (referrer.id === user.id) return NextResponse.json({ error: 'Tidak boleh guna kod sendiri' }, { status: 400 })

  // Check if this user already has a referral record (each user can only be referred once)
  const { data: existing } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, skipped: true })

  // Cap referrer rewards: max 20 referrals per month to prevent spam farming
  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const { count: monthlyCount } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrer.id)
    .gte('created_at', monthStart.toISOString())

  if ((monthlyCount ?? 0) >= 20) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Create referral row
  const { error: insErr } = await supabase.from('referrals').insert({
    referrer_id: referrer.id,
    referee_id: user.id,
    referee_pts: 50,
    referrer_pts: 100,
    status: 'pending',
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Award referee 50 welcome pts
  await supabase.from('loyalty_transactions').insert({
    user_id: user.id,
    points: 50,
    type: 'earn',
    description: 'Ganjaran rujukan — selamat datang!',
  })
  await supabase.rpc('increment_points', { uid: user.id, pts: 50 })

  return NextResponse.json({ ok: true })
}
