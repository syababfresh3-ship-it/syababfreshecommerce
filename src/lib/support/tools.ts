import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendAdminPush } from '@/lib/push'
import { CATALOG_TOOLS, runCatalogTool } from '@/lib/ai/catalog-tools'
import { toAnthropicTools } from '@/lib/ai/tools'

// Konteks aduan yang terikat pada sesi (dari token) — tool TIDAK terima order_id
// dari model (keselamatan: pelanggan hanya boleh akses order sendiri).
export interface SupportContext {
  admin: SupabaseClient
  complaintId: string
  orderKind: 'store' | 'lp'
  orderId: string
  orderNumber: string
}

export const SUPPORT_TOOLS: Anthropic.Tool[] = [
  ...(toAnthropicTools(CATALOG_TOOLS) as Anthropic.Tool[]),   // search_products + get_product_details (kongsi dgn chatbot WA)
  {
    name: 'get_order_status',
    description:
      'Dapatkan status & maklumat tracking order pelanggan untuk sesi ini (order sudah disahkan & terikat). Tiada parameter — sentiasa rujuk order pelanggan semasa.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_refund_status',
    description:
      'Semak status aduan/refund pelanggan untuk sesi ini (sama ada masih diproses CS atau sudah diselesaikan, dan butiran resolusi seperti refund/baucar/ganti). Guna bila pelanggan tanya pasal aduan atau refund mereka.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_complaint',
    description:
      'Escalate aduan kepada CS manusia dengan ringkasan + butiran kerosakan. Guna SELEPAS kumpul maklumat (dan gambar untuk aduan kualiti). JANGAN janji refund/ganti — ini cuma hantar aduan untuk CS susuli.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['rosak', 'hilang', 'lambat', 'salah_item', 'lain'], description: 'Kategori aduan.' },
        summary: { type: 'string', description: 'Ringkasan jelas untuk CS: apa masalah & rujukan gambar jika ada.' },
        damage_items: {
          type: 'array',
          description: 'Untuk aduan rosak/hilang/salah_item: senarai item terlibat + kuantiti/peratus rosak. Kosongkan untuk aduan lain (cth lambat).',
          items: {
            type: 'object',
            properties: {
              item: { type: 'string', description: 'Nama produk, cth "Durian Musang King".' },
              qty_ordered: { type: 'number', description: 'Kuantiti dipesan (jika tahu).' },
              calc: { type: 'string', enum: ['per_unit', 'peratus'], description: 'per_unit = guna bilangan unit rosak; peratus = guna % rosak.' },
              rosak_qty: { type: 'number', description: 'Bilangan unit rosak (jika calc=per_unit).' },
              percent_rosak: { type: 'number', description: 'Peratus rosak 0–100 (jika calc=peratus).' },
            },
            required: ['item', 'calc'],
          },
        },
      },
      required: ['category', 'summary'],
    },
  },
]

// Mod guest: hanya tool katalog (tiada order/aduan).
export const GUEST_TOOLS: Anthropic.Tool[] = SUPPORT_TOOLS.filter((t) => t.name === 'search_products' || t.name === 'get_product_details')

export async function runSupportTool(name: string, input: Record<string, unknown>, ctx: SupportContext): Promise<string> {
  const cat = await runCatalogTool(ctx.admin, name, input)   // search_products / get_product_details
  if (cat !== null) return cat
  if (name === 'get_order_status') return getOrderStatus(ctx)
  if (name === 'get_refund_status') return getRefundStatus(ctx)
  if (name === 'create_complaint')
    return createComplaint(ctx, String(input.category ?? 'lain'), String(input.summary ?? ''), Array.isArray(input.damage_items) ? input.damage_items : [])
  return `Tool tidak dikenali: ${name}`
}

async function getOrderStatus(ctx: SupportContext): Promise<string> {
  if (ctx.orderKind === 'store') {
    const { data: order } = await ctx.admin
      .from('orders')
      .select('order_number, status')
      .eq('id', ctx.orderId)
      .maybeSingle()
    if (!order) return 'Order tidak dijumpai.'
    const { data: ship } = await ctx.admin
      .from('order_shipments')
      .select('tracking_number, tracking_url')
      .eq('order_id', ctx.orderId)
      .is('refund_id', null)
      .maybeSingle()
    return JSON.stringify({
      order: order.order_number,
      status: order.status,
      tracking_no: ship?.tracking_number ?? null,
      tracking_url: ship?.tracking_url ?? null,
    })
  }
  const { data: lp } = await ctx.admin
    .from('lp_guest_orders')
    .select('order_number, status, tracking_number, tracking_url')
    .eq('id', ctx.orderId)
    .maybeSingle()
  if (!lp) return 'Order tidak dijumpai.'
  return JSON.stringify({
    order: lp.order_number,
    status: lp.status,
    tracking_no: lp.tracking_number ?? null,
    tracking_url: lp.tracking_url ?? null,
  })
}

async function getRefundStatus(ctx: SupportContext): Promise<string> {
  const { data: c } = await ctx.admin
    .from('support_complaints')
    .select('status, category')
    .eq('id', ctx.complaintId)
    .maybeSingle()
  if (!c) return 'Tiada aduan untuk sesi ini.'
  return JSON.stringify({
    status_aduan: c.status, // open=baru, escalated=CS sedang uruskan, resolved=selesai, rejected=ditolak
    kategori: c.category,
  })
}

async function createComplaint(
  ctx: SupportContext,
  category: string,
  summary: string,
  damageItems: unknown[],
): Promise<string> {
  // Baca complaint untuk semak gambar + maklumat pelanggan
  const { data: c } = await ctx.admin
    .from('support_complaints')
    .select('image_urls, customer_name')
    .eq('id', ctx.complaintId)
    .maybeSingle()

  const hasImage = (c?.image_urls?.length ?? 0) > 0
  // Guard server-side: aduan kualiti (rosak) wajib gambar
  if (category === 'rosak' && !hasImage) {
    return 'GAGAL: aduan kualiti (buah rosak) memerlukan sekurang-kurangnya satu gambar bukti. Minta pelanggan muat naik gambar dahulu, kemudian cuba lagi.'
  }

  const { error } = await ctx.admin
    .from('support_complaints')
    .update({
      category,
      ai_summary: summary,
      damage_items: damageItems,
      status: 'escalated',
      handled_by: 'ai',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.complaintId)
  if (error) return `Ralat hantar aduan: ${error.message}`

  // Notify admin (push). CS lihat penuh di /admin/support.
  await sendAdminPush({
    title: `🆘 Aduan baru — ${ctx.orderNumber}`,
    body: `${c?.customer_name ?? 'Pelanggan'} · ${category}${hasImage ? ' · ada gambar' : ''}`,
    url: '/admin/support',
    tag: 'support-complaint',
  }).catch(() => {})

  return `BERJAYA: aduan untuk order ${ctx.orderNumber} telah dihantar kepada CS. Beritahu pelanggan CS akan susuli (dalam masa bekerja) dan rujukan order mereka ${ctx.orderNumber}.`
}
