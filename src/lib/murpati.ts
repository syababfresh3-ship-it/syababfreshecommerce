const BASE_URL = process.env.MURPATI_BASE_URL ?? 'https://api.murpati.com'
const API_KEY = process.env.MURPATI_API_KEY ?? ''
const SESSION_ID = process.env.MURPATI_SESSION_ID ?? ''

export async function sendWhatsApp(to: string, message: string) {
  if (!API_KEY || !SESSION_ID) {
    console.warn('[murpati] MURPATI_API_KEY or MURPATI_SESSION_ID not set — skipping')
    return { skipped: true }
  }

  // Normalize phone — strip leading 0, ensure starts with 60
  let phone = to.replace(/\D/g, '')
  if (phone.startsWith('0')) phone = '6' + phone
  if (!phone.startsWith('60')) phone = '60' + phone

  try {
    const res = await fetch(`${BASE_URL}/v1/messages/send`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: SESSION_ID,
        to: phone,
        message,
      }),
    })

    const data = await res.json()
    return { success: res.ok, murpati: data }
  } catch (err) {
    console.error('[murpati] Failed to send:', err)
    return { error: 'Failed to send WhatsApp' }
  }
}
