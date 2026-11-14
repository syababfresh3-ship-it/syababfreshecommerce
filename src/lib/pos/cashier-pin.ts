import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidPin, verifyPin } from '@/lib/pos/pin'
import type { PosCashier } from '@/lib/pos/types'

// Semakan PIN kasyer + kunci akaun (5 salah berturut-turut → kunci 15 minit), dikongsi oleh
// /api/pos/pin (log masuk & verify_only) dan /api/pos/sales/[id]/void (PIN manager). Sebelum 14 Nov 2026
// void tak menyentuh kaunter gagal → PIN manager boleh diteka tanpa had selain 10/min/IP yang dikongsi
// semua peranti kedai. Pemanggil kekal bertanggungjawab untuk rate limit IP/id sebelum memanggil.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export const PIN_LOCK_AFTER = 5
export const PIN_LOCK_MINUTES = 15

export type PinCheck = { ok: true; cashier: PosCashier } | { ok: false; status: number; error: string }

export async function checkCashierPin(sb: SB, cashierId: unknown, pin: unknown, opts: { requireManager?: boolean } = {}): Promise<PinCheck> {
  if (typeof cashierId !== 'string' || !cashierId || !isValidPin(pin)) return { ok: false, status: 400, error: 'A 4–6 digit PIN is required' }
  const { data: c, error } = await sb.from('pos_cashiers').select('id, name, role, pin_hash, is_active, failed_attempts, locked_until').eq('id', cashierId).maybeSingle()
  if (error) return { ok: false, status: 500, error: error.message }
  if (!c || !c.is_active) return { ok: false, status: 404, error: 'Cashier not found' }
  if (opts.requireManager && c.role !== 'manager') return { ok: false, status: 403, error: 'Not a manager' }
  if (c.locked_until && new Date(c.locked_until) > new Date()) {
    return { ok: false, status: 423, error: `Cashier locked. Try again after ${new Date(c.locked_until).toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' })}` }
  }
  if (!verifyPin(pin, c.pin_hash)) {
    const attempts = (c.failed_attempts ?? 0) + 1
    const patch: Record<string, unknown> = { failed_attempts: attempts }
    if (attempts >= PIN_LOCK_AFTER) { patch.locked_until = new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString(); patch.failed_attempts = 0 }
    await sb.from('pos_cashiers').update(patch).eq('id', c.id)
    return { ok: false, status: 401, error: attempts >= PIN_LOCK_AFTER ? `Wrong PIN ${PIN_LOCK_AFTER} times — locked for ${PIN_LOCK_MINUTES} minutes` : 'Wrong PIN' }
  }
  await sb.from('pos_cashiers').update({ failed_attempts: 0, locked_until: null }).eq('id', c.id)
  return { ok: true, cashier: { id: c.id, name: c.name, role: c.role === 'manager' ? 'manager' : 'cashier' } }
}
