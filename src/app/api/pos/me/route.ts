import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { getAppSettings } from '@/lib/app-settings'
import { POS_SETTINGS_KEY, parsePosSettings } from '@/lib/pos/settings'

// Bootstrap peranti POS: siapa login, kasyer semasa (kuki PIN), register, senarai kasyer (nama
// sahaja — untuk pad PIN), tetapan. migrationOk=false bila jadual 155 belum wujud (UI tunjuk amaran).
export const dynamic = 'force-dynamic'

const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

export async function GET() {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const sb = auth.supabase!

  // Outlet per register (migration 157) — jatuh ke select asas jika kolum/jadual belum ada
  const regsFull = await sb.from('pos_registers').select('id, code, name, location, outlet_id, outlet:pos_outlets!outlet_id(code, name, type)').eq('is_active', true).order('code')
  const [regs, cashiers, settingsMap] = await Promise.all([
    regsFull.error ? sb.from('pos_registers').select('id, code, name, location').eq('is_active', true).order('code') : Promise.resolve(regsFull),
    sb.from('pos_cashiers').select('id, name, role').eq('is_active', true).order('name'),
    getAppSettings(),
  ])
  const migrationOk = !(regs.error && MISSING_TABLE.has(regs.error.code ?? ''))

  return NextResponse.json({
    user: auth.user,
    isAdmin: auth.isAdmin,
    cashier: auth.cashier,
    registers: regs.data ?? [],
    cashiers: cashiers.data ?? [],
    settings: parsePosSettings(settingsMap[POS_SETTINGS_KEY]),
    migrationOk,
    pinEnabled: !!process.env.POS_PIN_SECRET,
  })
}
