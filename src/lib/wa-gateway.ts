// ============================================================
// wa-gateway — klien untuk gateway WhatsApp sendiri (Baileys, API serasi Murpati)
// di wa.syababfresh.my. Nombor gateway didaftar dalam wa_numbers dengan
// phone_number_id = 'gw:<session_id>' supaya inbox/multi-number sedia ada boleh
// membezakannya daripada nombor Meta Cloud tanpa migration.
//
// Env: WA_GATEWAY_URL / WA_GATEWAY_KEY (fallback MURPATI_BASE_URL / MURPATI_API_KEY —
// gateway memang serasi Murpati), WA_GATEWAY_WEBHOOK_SECRET (sahkan webhook masuk).
// ============================================================

const BASE = (process.env.WA_GATEWAY_URL || process.env.MURPATI_BASE_URL || '').replace(/\/$/, '')
const KEY = process.env.WA_GATEWAY_KEY || process.env.MURPATI_API_KEY || ''

export const GW_PREFIX = 'gw:'
export const isGatewayNumber = (id?: string | null): boolean => !!id && id.startsWith(GW_PREFIX)
export const gatewaySessionId = (numberId: string): string => numberId.slice(GW_PREFIX.length)
export const gatewayNumberId = (sessionId: string): string => GW_PREFIX + sessionId

export function gatewayConfigured(): boolean {
  return !!BASE && !!KEY
}

export interface GatewaySendResult { ok: boolean; id?: string; error?: string }

async function call(path: string, body: Record<string, unknown>): Promise<GatewaySendResult> {
  if (!gatewayConfigured()) return { ok: false, error: 'Gateway WA belum dikonfigurasi (WA_GATEWAY_URL / WA_GATEWAY_KEY).' }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; message_id?: string | null }
    if (!res.ok || data.success === false) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, id: data.message_id ?? undefined }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export function gatewaySendText(sessionId: string, to: string, message: string): Promise<GatewaySendResult> {
  return call('/v1/messages/send', { session_id: sessionId, to, message })
}

export function gatewaySendMedia(
  sessionId: string,
  to: string,
  mediaUrl: string,
  opts: { caption?: string; mediaType?: 'image' | 'video' | 'audio' | 'document'; fileName?: string } = {},
): Promise<GatewaySendResult> {
  return call('/v1/messages/send-media', {
    session_id: sessionId,
    to,
    media_url: mediaUrl,
    caption: opts.caption,
    media_type: opts.mediaType,
    file_name: opts.fileName,
  })
}

/** Muat turun media mesej masuk dari gateway (path dari payload webhook `media.path`). */
export async function gatewayFetchMedia(mediaPath: string): Promise<{ data: ArrayBuffer; mime: string } | null> {
  if (!gatewayConfigured() || !mediaPath.startsWith('/v1/media/')) return null
  try {
    const res = await fetch(`${BASE}${mediaPath}`, { headers: { 'X-API-Key': KEY } })
    if (!res.ok) return null
    return { data: await res.arrayBuffer(), mime: (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim() }
  } catch {
    return null
  }
}

export interface GatewaySession { session_id: string; status: string; phone_number?: string | null; device_name?: string | null; sent_today?: number }

/** GET /v1/sessions dengan timeout 10s — untuk pemeriksa kesihatan (cron wa-gateway-health). */
export async function gatewayListSessions(): Promise<{ ok: boolean; sessions: GatewaySession[]; error?: string }> {
  if (!gatewayConfigured()) return { ok: false, sessions: [], error: 'gateway tidak dikonfigurasi' }
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 10_000)
  try {
    const res = await fetch(`${BASE}/v1/sessions`, { headers: { 'X-API-Key': KEY }, signal: ctl.signal, cache: 'no-store' })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; sessions?: GatewaySession[]; error?: string }
    if (!res.ok || data.success === false) return { ok: false, sessions: [], error: data.error || `HTTP ${res.status}` }
    return { ok: true, sessions: data.sessions ?? [] }
  } catch (e) {
    return { ok: false, sessions: [], error: e instanceof Error && e.name === 'AbortError' ? 'timeout 10s' : String(e) }
  } finally {
    clearTimeout(t)
  }
}
