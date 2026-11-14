import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { POS_CASHIER_COOKIE, readCashier } from '@/lib/pos/pin'
import type { PosCashier } from '@/lib/pos/types'

// Gate API POS (/api/pos/*): login Supabase + (is_admin ATAU pos_staff aktif).
// Pulangkan klien SERVICE ROLE (jadual pos_* RLS admin-sahaja; akaun peranti bukan admin).
// opts.cashier → wajib kuki PIN kasyer sah; opts.manager → kasyer role manager atau admin.
// Corak sama dengan requireAdmin (pemanggil semak `forbidden` dahulu).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export interface PosAuth {
  supabase: SB | null
  user: { id: string; email?: string | null } | null
  isAdmin: boolean
  cashier: PosCashier | null
  forbidden: NextResponse | null
}

const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

const deny = (status: number, error: string, code?: string): PosAuth =>
  ({ supabase: null, user: null, isAdmin: false, cashier: null, forbidden: NextResponse.json({ error, code }, { status }) })

export async function hasPosAccess(sb: SB, userId: string): Promise<{ ok: boolean; isAdmin: boolean }> {
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
  if (profile?.is_admin) return { ok: true, isAdmin: true }
  const { data: staff, error } = await sb.from('pos_staff').select('is_active').eq('profile_id', userId).maybeSingle()
  if (error && MISSING_TABLE.has(error.code ?? '')) return { ok: false, isAdmin: false }
  return { ok: !!staff?.is_active, isAdmin: false }
}

export async function requirePos(opts: { cashier?: boolean; manager?: boolean } = {}): Promise<PosAuth> {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return deny(401, 'Unauthorized')

  const supabase = createAdminClient()
  const access = await hasPosAccess(supabase, user.id)
  if (!access.ok) return deny(403, 'No POS access', 'NO_POS_ACCESS')

  const jar = await cookies()
  let cashier = readCashier(jar.get(POS_CASHIER_COOKIE)?.value)
  // Kuki sah ≠ kasyer masih sah: semak semula DB setiap permintaan supaya sesi 12 jam boleh dibatalkan
  // serta-merta — nyahaktif, reset PIN atau tukar peranan (admin PATCH tulis updated_at) → kuki lama ditolak
  // (UI minta PIN semula). Peranan/nama diambil dari DB, bukan kuki. Ralat DB → kekal ikut kuki (jangan
  // tumbangkan kaunter kerana gangguan sementara).
  if (cashier) {
    const { data: row, error } = await supabase.from('pos_cashiers').select('name, role, is_active, updated_at').eq('id', cashier.id).maybeSingle()
    if (!error) {
      const changedAfterLogin = cashier.issuedAt != null && !!row?.updated_at && Date.parse(row.updated_at) / 1000 > cashier.issuedAt + 1
      cashier = !row || !row.is_active || changedAfterLogin
        ? null
        : { id: cashier.id, name: row.name, role: row.role === 'manager' ? 'manager' : 'cashier', issuedAt: cashier.issuedAt }
    }
  }
  if (opts.cashier && !cashier) return deny(401, 'Cashier PIN required', 'PIN_REQUIRED')
  if (opts.manager && !access.isAdmin && cashier?.role !== 'manager') return deny(403, 'Manager PIN required', 'MANAGER_REQUIRED')

  return { supabase, user: { id: user.id, email: user.email }, isAdmin: access.isAdmin, cashier, forbidden: null }
}
