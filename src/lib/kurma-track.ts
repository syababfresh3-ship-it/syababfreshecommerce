// Helper tracking + WhatsApp untuk landing page kurma.
// Fire event 'Lead' (Meta Pixel) + bawa angle/UTM ke mesej WA supaya iklan boleh
// optimize & sales tahu sumber. Pixel global (app_settings.meta_pixel_id) sudah
// fire PageView di semua route; sini kita tambah 'Lead' pada klik WA.
//
// Prinsip Lead:
//  - SEKALI sesesi (eventID stabil dlm sessionStorage) — FAB + calculator dulu tembak 2×, overcount.
//  - eventID dihantar ke fbq → boleh dedup dgn CAPI pelayan nanti (event_id sama).
//  - TIADA `value` pada Lead — anggaran order (sampai RM18k) bukan hasil; ia cemar laporan
//    nilai & value-optimization. Hantar sebagai `estimate` + angle/UTM untuk segmen.

export const KURMA_WA = '601156403601' // 011-5640 3601

export function getUtm(): { source?: string; campaign?: string; content?: string; raw: string } {
  if (typeof window === 'undefined') return { raw: '' }
  try {
    const p = new URLSearchParams(window.location.search)
    const source = p.get('utm_source') || undefined
    const campaign = p.get('utm_campaign') || undefined
    const content = p.get('utm_content') || undefined
    return { source, campaign, content, raw: [source, campaign, content].filter(Boolean).join('/') }
  } catch { return { raw: '' } }
}

/** Baris sumber untuk mesej WA (angle LP + UTM iklan) — sales nampak dari mana lead datang. */
export function sourceLine(angle?: string): string {
  const u = getUtm()
  const parts = [angle ? `angle:${angle}` : '', u.raw ? `utm:${u.raw}` : ''].filter(Boolean)
  return parts.length ? `\n\n— via: ${parts.join(' · ')}` : ''
}

export function waUrl(text: string): string {
  return `https://wa.me/${KURMA_WA}?text=${encodeURIComponent(text)}`
}

const LEAD_KEY = 'kurma_lead_event_id'

/** eventID stabil sepanjang sesi. fresh=false → Lead dah ditembak sesi ini. */
function leadEventId(): { id: string; fresh: boolean } {
  try {
    const existing = sessionStorage.getItem(LEAD_KEY)
    if (existing) return { id: existing, fresh: false }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(LEAD_KEY, id)
    return { id, fresh: true }
  } catch {
    return { id: `lead_${Date.now()}`, fresh: true }
  }
}

/** Fire 'Lead' SEKALI sesesi pada Meta Pixel (+ Google gtag jika ada). Dipanggil pada klik WA. */
export function fireLead(label: string, angle?: string, estimate?: number) {
  try {
    const { id, fresh } = leadEventId()
    if (!fresh) return   // dah tembak sesi ini — jangan overcount
    const u = getUtm()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.fbq?.('track', 'Lead', {
      content_name: label,
      content_category: 'gift-kurma',
      ...(angle ? { angle } : {}),
      ...(u.source ? { utm_source: u.source } : {}),
      ...(u.campaign ? { utm_campaign: u.campaign } : {}),
      ...(u.content ? { utm_content: u.content } : {}),
      ...(estimate ? { estimate } : {}),
    }, { eventID: id })
    w.gtag?.('event', 'generate_lead', { content_name: label, ...(angle ? { angle } : {}) })
    // CAPI pelayan dengan event_id SAMA → Meta dedup; pulihkan isyarat yang pixel pelayar hilang
    // (iOS/adblocker). keepalive: kekal dihantar walau tab terus navigasi ke WhatsApp.
    fetch('/api/kurma/lead', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: id, label, angle, estimate, utm: { source: u.source, campaign: u.campaign, content: u.content } }),
    }).catch(() => {})
  } catch { /* abaikan */ }
}

/** Buka WhatsApp dengan mesej + sumber, dan fire Lead (sekali sesesi). Fallback bila popup disekat. */
export function openWaLead(text: string, angle: string | undefined, estimate: number, label: string) {
  fireLead(label, angle, estimate)
  const url = waUrl(text + sourceLine(angle))
  try {
    // Tanpa 'noopener' dlm features supaya dapat rujukan tetingkap (noopener → sentiasa null,
    // fallback akan tersalah navigasi tab ini). Putus opener secara manual.
    const win = window.open(url, '_blank')
    if (win) win.opener = null
    else window.location.href = url   // popup disekat → navigasi terus ke WhatsApp
  } catch {
    try { window.location.href = url } catch { /* abaikan */ }
  }
}
