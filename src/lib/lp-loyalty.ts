import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_POINTS_PER_ORDER = 5000

// Award loyalty points + spend for an LP guest order IF the buyer's phone matches a
// registered profile. Idempotent: the `loyalty_awarded` flag is claimed atomically so
// the points are granted at most once across the webhook / verify / delivered paths.
//
// Pass a service-role client (createAdminClient) so the loyalty RPCs run.
export async function awardLpLoyalty(
  supabase: SupabaseClient,
  lp: {
    id: string; order_number: string; phone: string; total: number | string
    payment_method?: string | null; payment_status?: string | null; user_id?: string | null
    source?: string | null; email?: string | null
  }
): Promise<{ awarded: boolean; userId?: string; points?: number }> {
  // Order borong (reseller) = B2B, bukan retail → tiada mata loyalty.
  if (lp.source === 'reseller') return { awarded: false }

  // Payment guard: online (fpx/ewallet) must be paid; COD/bank settle on delivery.
  // Don't reward an unpaid online order even if it was marked delivered.
  const settled = lp.payment_status === 'paid'
    || lp.payment_method === 'cod' || lp.payment_method === 'bank_transfer'
  if (!settled) return { awarded: false }

  // Identify the customer: prefer the linked account (logged-in LP order),
  // else match a registered profile by phone (normalized — last 9 digits).
  let profile: { id: string; multiplier?: number | null } | null = null
  if (lp.user_id) {
    const { data } = await supabase.from('profiles').select('id, loyalty_tiers(multiplier)').eq('id', lp.user_id).single()
    if (data) profile = { id: data.id, multiplier: (data.loyalty_tiers as any)?.multiplier ?? 1 }
  } else {
    // Padan ikut telefon (normalize 9 digit) dahulu.
    const { data: match } = await supabase.rpc('find_profile_by_phone', { p_phone: lp.phone })
    profile = Array.isArray(match) ? match[0] : match
    // Fallback ikut email — perlu untuk login Google (tiada telefon). Order guest
    // storefront simpan email; padan ke profil berdaftar yang emailnya sama.
    if (!profile?.id) {
      let mEmail = (lp.email ?? '').trim().toLowerCase()
      if (!mEmail) {
        const { data: row } = await supabase.from('lp_guest_orders').select('email').eq('id', lp.id).single()
        mEmail = (row?.email ?? '').trim().toLowerCase()
      }
      if (mEmail) {
        const { data: byEmail } = await supabase
          .from('profiles')
          .select('id, loyalty_tiers(multiplier)')
          .ilike('email', mEmail)
          .limit(1)
          .maybeSingle()
        if (byEmail) profile = { id: byEmail.id, multiplier: (byEmail.loyalty_tiers as any)?.multiplier ?? 1 }
      }
    }
  }
  if (!profile?.id) return { awarded: false }

  // Claim the award — only the first caller flips the flag from false → true
  const { data: claimed } = await supabase
    .from('lp_guest_orders')
    .update({ loyalty_awarded: true })
    .eq('id', lp.id)
    .eq('loyalty_awarded', false)
    .select('id')
    .maybeSingle()
  if (!claimed) return { awarded: false } // already awarded

  const multiplier = Number(profile.multiplier ?? 1)
  const total = Number(lp.total)
  const points = Math.min(Math.floor(total * multiplier), MAX_POINTS_PER_ORDER)

  await supabase.from('loyalty_transactions').insert({
    user_id: profile.id,
    order_id: null, // LP order id is not in public.orders (FK) — keep null
    points,
    type: 'earn',
    description: `Pembelian LP ${lp.order_number}`,
  })
  await Promise.all([
    supabase.rpc('increment_points', { uid: profile.id, pts: points }),
    supabase.rpc('increment_spend', { uid: profile.id, amount: total }),
  ])

  return { awarded: true, userId: profile.id, points }
}
