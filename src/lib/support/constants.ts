// Nombor WhatsApp CS manusia (untuk pelanggan yang nak cakap dengan manusia,
// atau fallback selepas AI escalate). Boleh override via env.
export const HUMAN_WA = process.env.NEXT_PUBLIC_HUMAN_WHATSAPP ?? '601156403601'

export function humanWaUrl(prefill?: string): string {
  const text = prefill ?? 'Hai SyababFresh, saya nak bercakap dengan CS.'
  return `https://wa.me/${HUMAN_WA}?text=${encodeURIComponent(text)}`
}
