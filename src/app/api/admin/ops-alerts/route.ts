import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gatewayListGroups, gatewaySendText, gatewaySessionId } from '@/lib/wa-gateway'
import { OPS_ALERT_KEYS, OPS_ALERT_KINDS, parseOpsAlertConfig, klStamp } from '@/lib/ops-alerts'

// Tetapan amaran operasi (lib/ops-alerts) — UI: /admin/settings/whatsapp → "Amaran operasi".
// GET  : tetapan semasa + nombor gateway (wa_numbers gw:*) + kumpulan nombor terpilih (?session=)
// PATCH: simpan tetapan (app_settings ops_alert_*)
// POST : {action:'test'} hantar satu mesej ujian TERUS melalui gateway (bukan wa_outbox)

const SESSION_RE = /^[A-Za-z0-9_-]{4,80}$/
const GROUP_RE = /^[0-9-]+@g\.us$/

async function requireAdmin() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return me?.is_admin ? admin : null
}

async function loadSettings(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.from('app_settings').select('key, value').in('key', [...OPS_ALERT_KEYS])
  return Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map(r => [r.key, r.value])) as Record<string, string>
}

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const session = new URL(req.url).searchParams.get('session') ?? ''

  const [settings, numbers] = await Promise.all([
    loadSettings(admin),
    admin.from('wa_numbers').select('phone_number_id, display_name').like('phone_number_id', 'gw:%').eq('is_active', true).order('created_at'),
  ])
  const cfg = parseOpsAlertConfig(settings)
  const sessions = ((numbers.data ?? []) as { phone_number_id: string; display_name: string }[])
    .map(n => ({ sessionId: gatewaySessionId(n.phone_number_id), label: n.display_name }))
  const target = SESSION_RE.test(session) ? session : cfg.sessionId
  const groups = target ? await gatewayListGroups(target) : { ok: true, groups: [], error: undefined as string | undefined }

  return NextResponse.json({
    config: { ...cfg, kinds: [...cfg.kinds] },
    kinds: OPS_ALERT_KINDS,
    sessions,
    groupsFor: target || null,
    groups: groups.groups,
    groupsError: groups.ok ? null : (groups.error ?? 'gagal muat kumpulan'),
  })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as {
    enabled?: boolean; sessionId?: string; groupJid?: string; groupName?: string; kinds?: string[]; lowStock?: number | string; stockInCost?: boolean
  }
  const sessionId = String(body.sessionId ?? '').trim()
  const groupJid = String(body.groupJid ?? '').trim()
  if (sessionId && !SESSION_RE.test(sessionId)) return NextResponse.json({ error: 'Session tidak sah' }, { status: 400 })
  if (groupJid && !GROUP_RE.test(groupJid)) return NextResponse.json({ error: 'JID kumpulan tidak sah (format 1234567890@g.us)' }, { status: 400 })
  if (body.enabled && (!sessionId || !groupJid)) return NextResponse.json({ error: 'Pilih nombor dan kumpulan sebelum hidupkan.' }, { status: 400 })
  const allowed = new Set(OPS_ALERT_KINDS.map(k => k.key as string))
  const kinds = (Array.isArray(body.kinds) ? body.kinds : []).filter(k => allowed.has(k))
  const low = parseInt(String(body.lowStock ?? '5'), 10)

  const rows = [
    { key: 'ops_alert_enabled', value: body.enabled ? 'on' : 'off' },
    { key: 'ops_alert_session_id', value: sessionId },
    { key: 'ops_alert_group_jid', value: groupJid },
    { key: 'ops_alert_group_name', value: String(body.groupName ?? '').slice(0, 120) },
    { key: 'ops_alert_kinds', value: kinds.join(',') },
    { key: 'ops_alert_low_stock', value: String(Number.isFinite(low) && low >= 0 && low <= 1000 ? low : 5) },
    { key: 'ops_alert_stock_in_cost', value: body.stockInCost === false ? 'off' : 'on' },
  ].map(r => ({ ...r, updated_at: new Date().toISOString() }))
  const { error } = await admin.from('app_settings').upsert(rows, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('app-settings', 'default')
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { action?: string; sessionId?: string; groupJid?: string }
  if (body.action !== 'test') return NextResponse.json({ error: 'Tindakan tidak dikenali' }, { status: 400 })
  const saved = parseOpsAlertConfig(await loadSettings(admin))
  const sessionId = String(body.sessionId ?? saved.sessionId).trim()
  const groupJid = String(body.groupJid ?? saved.groupJid).trim()
  if (!SESSION_RE.test(sessionId) || !GROUP_RE.test(groupJid)) return NextResponse.json({ error: 'Pilih nombor dan kumpulan dahulu.' }, { status: 400 })
  const text = ['*Ujian amaran operasi*', 'Mesej ini dihantar dari tetapan admin SyababFresh untuk sahkan nombor dan kumpulan.', klStamp()].join('\n')
  const res = await gatewaySendText(sessionId, groupJid, text)
  return NextResponse.json({ ok: res.ok, id: res.id ?? null, error: res.ok ? null : `${res.error}${res.code ? ` (${res.code})` : ''}` }, { status: res.ok ? 200 : 502 })
}
