import { createAdminClient } from '@/lib/supabase/admin'

export interface WaOutboxItem {
  phone: string
  message: string
  orderId?: string | null
  source?: string
}

// Beratur mesej WhatsApp dengan jadual BERPERINGKAT supaya drainer hantar
// sikit-sikit (bukan blast) → elak ban gateway tak rasmi (Murpati).
//
// Jitter 30–90s sesama mesej: mesej pertama hampir serta-merta, yg seterusnya
// disebar. Cth 100 mesej ≈ sebaran ~1–1.5 jam. Pulangkan bilangan di-enqueue.
export async function enqueueWhatsApp(items: WaOutboxItem[]): Promise<number> {
  const rows = items.filter((i) => i.phone && i.message)
  if (rows.length === 0) return 0

  const base = Date.now()
  let offset = 0 // ms terkumpul

  const payload = rows.map((i) => {
    const scheduled_at = new Date(base + offset).toISOString()
    offset += 30_000 + Math.floor(Math.random() * 60_000) // 30–90s
    return {
      phone: i.phone,
      message: i.message,
      order_id: i.orderId ?? null,
      source: i.source ?? 'tracking',
      scheduled_at,
    }
  })

  const admin = createAdminClient()
  const { error } = await admin.from('wa_outbox').insert(payload)
  if (error) {
    console.error('[wa-outbox] enqueue gagal:', error.message)
    return 0
  }
  return payload.length
}
