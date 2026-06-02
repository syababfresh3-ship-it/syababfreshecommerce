const BASE_URL = process.env.MURPATI_BASE_URL ?? 'https://api.murpati.com'
const API_KEY = process.env.MURPATI_API_KEY ?? ''

// Senarai session_id (banyak nombor WhatsApp) untuk sebar beban + failover —
// kurangkan risiko ban gateway tidak rasmi. Set di Vercel:
//   MURPATI_SESSION_IDS=id1,id2,id3   (comma-separated)
// Fallback ke MURPATI_SESSION_ID lama (satu nombor) kalau yang baru tak diset.
function getSessionIds(): string[] {
  const multi = (process.env.MURPATI_SESSION_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (multi.length) return multi
  const single = (process.env.MURPATI_SESSION_ID ?? '').trim()
  return single ? [single] : []
}

export async function sendWhatsApp(to: string, message: string) {
  const sessions = getSessionIds()
  if (!API_KEY || sessions.length === 0) {
    return { skipped: true }
  }

  // Normalize phone — strip leading 0, ensure starts with 60
  let phone = to.replace(/\D/g, '')
  if (phone.startsWith('0')) phone = '6' + phone
  if (!phone.startsWith('60')) phone = '60' + phone

  // Rotate: mula dari nombor rawak (sebar beban supaya tiada satu nombor
  // terlebih hantar). Failover: kalau nombor gagal/ban, cuba yang seterusnya.
  const start = sessions.length > 1 ? Math.floor(Math.random() * sessions.length) : 0
  let lastError: unknown = null

  for (let i = 0; i < sessions.length; i++) {
    const session_id = sessions[(start + i) % sessions.length]
    try {
      const res = await fetch(`${BASE_URL}/v1/messages/send`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id, to: phone, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) return { success: true, murpati: data, session_id }
      lastError = data // bukan ok → cuba session seterusnya (failover)
    } catch (e) {
      lastError = e // ralat rangkaian → cuba seterusnya
    }
  }

  return { success: false, error: 'All WhatsApp sessions failed', detail: lastError }
}
