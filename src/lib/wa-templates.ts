import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const DEFAULT_TEMPLATES: Record<string, string> = {
  wa_tmpl_greeting:           'Hi *{name}*! 👋',
  wa_tmpl_footer:             '_SyababFresh — Buah Segar Setiap Hari_ 🌿',
  wa_tmpl_confirmed:          '✅ Pesanan anda telah *disahkan*! Kami sedang menyediakan buah-buahan segar untuk anda.',
  wa_tmpl_preparing:          '🧺 Pesanan anda sedang *disediakan*. Buah-buahan segar sedang dipilih dengan teliti!',
  wa_tmpl_delivering:         '🚚 Pesanan anda sedang *dalam penghantaran*! Penghantar kami sedang dalam perjalanan.',
  wa_tmpl_delivered:          '🎉 Pesanan anda telah *selesai dihantar*! Terima kasih kerana memilih SyababFresh. Selamat menikmati! 🍎🍊',
  wa_tmpl_cancelled:          '❌ Pesanan anda telah *dibatalkan*. Hubungi kami jika ada pertanyaan.',
  wa_tmpl_order_received:     '📋 Pesanan anda telah *diterima*! Kami akan memproses pesanan anda tidak lama lagi.',
  wa_tmpl_payment_confirmed:  '💳 Bayaran FPX anda telah *diterima & disahkan*! Pesanan anda sedang diproses.',
}

export const getWaTemplates = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .like('key', 'wa_tmpl_%')
    const map: Record<string, string> = { ...DEFAULT_TEMPLATES }
    for (const row of data ?? []) map[row.key] = row.value
    return map
  },
  ['wa-templates'],
  { revalidate: 300, tags: ['app-settings'] }
)

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export function buildStatusMessage(
  templates: Record<string, string>,
  status: string,
  vars: { name: string; order_number: string; total?: string; tracking_url?: string }
): string | null {
  const tmplKey = `wa_tmpl_${status}`
  const statusMsg = templates[tmplKey] ?? DEFAULT_TEMPLATES[tmplKey]
  if (!statusMsg) return null

  const greeting = renderTemplate(templates.wa_tmpl_greeting ?? DEFAULT_TEMPLATES.wa_tmpl_greeting, vars)
  const footer = templates.wa_tmpl_footer ?? DEFAULT_TEMPLATES.wa_tmpl_footer

  const lines = [
    greeting,
    '',
    renderTemplate(statusMsg, vars),
    '',
    `📦 No. Pesanan: *${vars.order_number}*`,
  ]

  if (status === 'delivering' && vars.tracking_url) {
    lines.push('')
    lines.push('🔗 *Link Penghantaran:*')
    lines.push(vars.tracking_url)
  }

  lines.push('')
  lines.push(footer)

  return lines.join('\n')
}
