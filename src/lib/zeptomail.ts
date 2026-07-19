const ZEPTO_URL = 'https://api.zeptomail.com/v1.1/email'
const API_KEY   = process.env.ZEPTOMAIL_API_KEY ?? ''

const FROM_ORDER   = process.env.ZEPTOMAIL_FROM_ORDER   ?? 'order@mail.syababfresh.my'
const FROM_NOREPLY = process.env.ZEPTOMAIL_FROM_NOREPLY ?? 'noreply@mail.syababfresh.my'

// ─── shared helpers ────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="ms">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- header -->
        <tr><td style="background:#16a34a;padding:24px 32px;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">SyababFresh 🌿</p>
          <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.75);">Buah Segar Setiap Hari</p>
        </td></tr>

        <!-- body -->
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>

        <!-- footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 Syabab Trading Sdn Bhd &nbsp;·&nbsp; Klang Valley, Malaysia</p>
          <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">
            Sokongan: <a href="https://wa.me/601156816687" style="color:#16a34a;text-decoration:none;">WhatsApp Kami</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function itemsTable(items: Array<{ name: string; quantity: number; unit_price: number; variant_name?: string | null }>) {
  const rows = items.map(i => {
    const label = i.variant_name ? `${esc(i.name)} <span style="color:#6b7280;font-size:12px;">(${esc(i.variant_name)})</span>` : esc(i.name)
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">${label} × ${i.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;font-weight:600;text-align:right;white-space:nowrap;">
        RM${(Number(i.unit_price) * i.quantity).toFixed(2)}
      </td>
    </tr>`
  }).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">${rows}</table>`
}

function badge(text: string, color = '#16a34a') {
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;letter-spacing:0.5px;">${text}</span>`
}

// Pulang true bila email berjaya dihantar (penghantar lama abaikan nilai pulang —
// selamat). Broadcast guna nilai ni untuk kira sent/failed.
async function send(opts: {
  from: string
  fromName: string
  to: string
  toName: string
  subject: string
  html: string
  attachments?: { name: string; contentBase64: string; mimeType?: string }[]
}): Promise<boolean> {
  if (!API_KEY) {
    console.warn('[zeptomail] ZEPTOMAIL_API_KEY not set — skipping email')
    return false
  }

  try {
    const res = await fetch(ZEPTO_URL, {
      method: 'POST',
      headers: {
        Authorization: API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from: { address: opts.from, name: opts.fromName },
        to: [{ email_address: { address: opts.to, name: opts.toName } }],
        subject: opts.subject,
        htmlbody: opts.html,
        ...(opts.attachments?.length
          ? { attachments: opts.attachments.map(a => ({ content: a.contentBase64, mime_type: a.mimeType ?? 'application/pdf', name: a.name })) }
          : {}),
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[zeptomail] ${res.status} error:`, text)
      return false
    }
    return true
  } catch (err) {
    console.error('[zeptomail] fetch failed:', err)
    return false
  }
}

// ─── email 1: order confirmation (COD / bank transfer) ────────────────────────

export async function sendOrderConfirmationEmail(params: {
  to: string
  customerName: string
  orderNumber: string
  items: Array<{ name: string; quantity: number; unit_price: number; variant_name?: string | null }>
  total: number
  deliveryAddress: string | null
  deliverySlot: string | null
  paymentMethod: string
  notes: string | null
}) {
  const paymentLabel: Record<string, string> = {
    fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD (Bayar Semasa Terima)',
    bank_transfer: 'Pindahan Bank',
  }

  const html = layout('Pengesahan Pesanan', `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Terima kasih, <strong>${params.customerName}</strong>!</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#111827;">Pesanan Anda Diterima ✅</h1>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <tr>
        <td style="font-size:13px;color:#6b7280;">No. Pesanan</td>
        <td style="font-size:14px;font-weight:700;color:#111827;text-align:right;">${params.orderNumber}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;padding-top:6px;">Kaedah Bayar</td>
        <td style="font-size:14px;font-weight:700;color:#111827;text-align:right;padding-top:6px;">${paymentLabel[params.paymentMethod] ?? params.paymentMethod}</td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Item Pesanan</p>
    ${itemsTable(params.items)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
      <tr>
        <td style="font-size:15px;font-weight:800;color:#111827;padding-top:8px;">Jumlah</td>
        <td style="font-size:18px;font-weight:800;color:#16a34a;text-align:right;padding-top:8px;">RM${Number(params.total).toFixed(2)}</td>
      </tr>
    </table>

    ${params.deliveryAddress ? `
    <div style="margin-top:20px;padding:14px 16px;background:#f9fafb;border-radius:10px;border-left:3px solid #16a34a;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Alamat Penghantaran</p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">${params.deliveryAddress}</p>
      ${params.deliverySlot ? `<p style="margin:6px 0 0;font-size:12px;color:#16a34a;font-weight:600;">🕐 Slot: ${params.deliverySlot}</p>` : ''}
    </div>` : ''}

    ${params.notes ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">📝 Nota: ${params.notes}</p>` : ''}

    <div style="margin-top:24px;padding:14px 16px;background:#fffbeb;border-radius:10px;border:1px solid #fde68a;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
        ${params.paymentMethod === 'bank_transfer'
          ? `💳 Sila buat pindahan ke <strong>Maybank 562263630996</strong> (Syabab Trading Sdn Bhd) dan hantar bukti bayaran ke WhatsApp kami.`
          : `🚚 Pesanan anda sedang kami proses. Anda akan dimaklumkan bila pesanan dalam penghantaran.`
        }
      </p>
    </div>
  `)

  await send({
    from: FROM_ORDER,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.customerName,
    subject: `Pesanan ${params.orderNumber} Diterima — SyababFresh`,
    html,
  })
}

// ─── email 2: payment confirmed (FPX / e-wallet via Chip webhook) ──────────────

export async function sendPaymentConfirmedEmail(params: {
  to: string
  customerName: string
  orderNumber: string
  items: Array<{ name: string; quantity: number; unit_price: number; variant_name?: string | null }>
  total: number
  deliveryAddress: string | null
  deliverySlot: string | null
  notes: string | null
  receiptUrl?: string   // optional link to the official receipt page
}) {
  const html = layout('Pembayaran Disahkan', `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hai, <strong>${params.customerName}</strong>!</p>
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">Pembayaran Berjaya 🎉</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Terima kasih! Pembayaran anda telah disahkan dan pesanan sedang diproses.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <tr>
        <td style="font-size:13px;color:#6b7280;">No. Pesanan</td>
        <td style="font-size:14px;font-weight:700;color:#111827;text-align:right;">${params.orderNumber}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;padding-top:6px;">Status Bayaran</td>
        <td style="text-align:right;padding-top:6px;">${badge('DIBAYAR ✓')}</td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Item Pesanan</p>
    ${itemsTable(params.items)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
      <tr>
        <td style="font-size:15px;font-weight:800;color:#111827;padding-top:8px;">Jumlah Dibayar</td>
        <td style="font-size:18px;font-weight:800;color:#16a34a;text-align:right;padding-top:8px;">RM${Number(params.total).toFixed(2)}</td>
      </tr>
    </table>

    ${params.deliveryAddress ? `
    <div style="margin-top:20px;padding:14px 16px;background:#f9fafb;border-radius:10px;border-left:3px solid #16a34a;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Alamat Penghantaran</p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">${params.deliveryAddress}</p>
      ${params.deliverySlot ? `<p style="margin:6px 0 0;font-size:12px;color:#16a34a;font-weight:600;">🕐 Slot: ${params.deliverySlot}</p>` : ''}
    </div>` : ''}

    ${params.notes ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">📝 Nota: ${params.notes}</p>` : ''}

    ${params.receiptUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;"><tr><td align="center">
      <a href="${params.receiptUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 30px;border-radius:10px;">📄 Lihat / Muat Turun Resit Rasmi</a>
    </td></tr></table>` : ''}

    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      🚚 Kami akan maklumkan anda bila pesanan dalam penghantaran. Anggaran masa tiba: <strong>24 jam</strong> selepas pengesahan.
    </p>
  `)

  await send({
    from: FROM_ORDER,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.customerName,
    subject: `Pembayaran ${params.orderNumber} Berjaya — SyababFresh`,
    html,
  })
}

// ─── email 3: delivery status update ──────────────────────────────────────────

export async function sendDeliveryStatusEmail(params: {
  to: string
  customerName: string
  orderNumber: string
  status: string
  orderId?: string   // optional — LP guest orders tiada halaman /orders, jadi butang disorok
}) {
  type StatusConfig = { subject: string; headline: string; message: string; badgeText: string; badgeColor: string }

  const configs: Record<string, StatusConfig> = {
    preparing: {
      subject:    `Pesanan ${params.orderNumber} Sedang Disediakan`,
      headline:   'Pesanan Sedang Disediakan 🧺',
      message:    'Pasukan kami sedang memilih buah-buahan terbaik untuk anda. Pesanan akan dihantar tidak lama lagi.',
      badgeText:  'MENYEDIAKAN',
      badgeColor: '#d97706',
    },
    delivering: {
      subject:    `Pesanan ${params.orderNumber} Dalam Perjalanan!`,
      headline:   'Pesanan Dalam Perjalanan 🚚',
      message:    'Penghantar kami sedang dalam perjalanan ke rumah anda. Sila pastikan ada orang di rumah untuk menerima pesanan.',
      badgeText:  'DALAM PENGHANTARAN',
      badgeColor: '#2563eb',
    },
    delivered: {
      subject:    `Pesanan ${params.orderNumber} Telah Tiba!`,
      headline:   'Pesanan Telah Dihantar ✅',
      message:    'Pesanan anda telah berjaya dihantar. Terima kasih kerana memilih SyababFresh — selamat menikmati buah segar anda!',
      badgeText:  'SELESAI',
      badgeColor: '#16a34a',
    },
  }

  const cfg = configs[params.status]
  if (!cfg) return

  const html = layout(cfg.headline, `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hai, <strong>${params.customerName}</strong>!</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827;">${cfg.headline}</h1>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <tr>
        <td style="font-size:13px;color:#6b7280;">No. Pesanan</td>
        <td style="font-size:14px;font-weight:700;color:#111827;text-align:right;">${params.orderNumber}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;padding-top:6px;">Status</td>
        <td style="text-align:right;padding-top:6px;">${badge(cfg.badgeText, cfg.badgeColor)}</td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">${cfg.message}</p>

    ${params.status === 'delivered' ? `
    <div style="background:#f0fdf4;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
        ⭐ Puas dengan pesanan anda? <strong>Tinggalkan ulasan</strong> untuk membantu pelanggan lain memilih buah terbaik!
      </p>
    </div>` : ''}

    ${params.orderId ? `
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/${params.orderId}"
       style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;">
      Lihat Pesanan →
    </a>` : ''}

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Ada masalah? Hubungi kami via WhatsApp dan kami akan selesaikan segera.</p>
  `)

  await send({
    from: FROM_NOREPLY,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.customerName,
    subject: cfg.subject,
    html,
  })
}

// ─── email 4: tracking notification ───────────────────────────────────────────

export async function sendTrackingEmail(params: {
  to: string
  customerName: string
  orderNumber: string
  orderId: string
  carrierName: string
  trackingNumber: string | null
  trackingUrl: string | null
  estimatedDelivery: string | null
}) {
  const trackingBlock = params.trackingUrl
    ? `<a href="${params.trackingUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;margin-bottom:16px;">
        Jejak Penghantaran →
      </a>`
    : params.trackingNumber
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
          <tr>
            <td style="font-size:13px;color:#1d4ed8;">No. Tracking</td>
            <td style="font-size:15px;font-weight:800;color:#1e40af;text-align:right;font-family:monospace;">${params.trackingNumber}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#1d4ed8;padding-top:6px;">Kurier</td>
            <td style="font-size:14px;font-weight:600;color:#1e40af;text-align:right;padding-top:6px;">${params.carrierName}</td>
          </tr>
        </table>`
      : ''

  const estimatedBlock = params.estimatedDelivery
    ? `<p style="margin:0 0 20px;font-size:13px;color:#6b7280;">
        📅 Anggaran tiba: <strong style="color:#111827;">${new Date(params.estimatedDelivery).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
      </p>`
    : ''

  const html = layout('Pesanan Dalam Perjalanan 🚚', `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hai, <strong>${params.customerName}</strong>!</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827;">Pesanan Dalam Perjalanan 🚚</h1>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <tr>
        <td style="font-size:13px;color:#6b7280;">No. Pesanan</td>
        <td style="font-size:14px;font-weight:700;color:#111827;text-align:right;">${params.orderNumber}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;padding-top:6px;">Kurier</td>
        <td style="font-size:14px;font-weight:600;color:#111827;text-align:right;padding-top:6px;">${params.carrierName}</td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
      Pesanan anda sedang dalam perjalanan! Penghantar kami sedang menuju ke alamat anda.
    </p>

    ${trackingBlock}
    ${estimatedBlock}

    <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/${params.orderId}"
       style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;">
      Lihat Status Pesanan →
    </a>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Ada masalah? Hubungi kami via WhatsApp dan kami akan selesaikan segera.</p>
  `)

  await send({
    from: FROM_NOREPLY,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.customerName,
    subject: `Pesanan ${params.orderNumber} Dalam Perjalanan 🚚`,
    html,
  })
}

// ─── email 5: abandoned payment reminder (online order belum dibayar) ──────────
// Dihantar oleh /api/cron/payment-reminder bila order FPX/e-wallet masih unpaid
// > 1 jam. payUrl = /api/pay/[id] yang jana semula checkout Chip (tak pernah basi).

export async function sendPaymentReminderEmail(params: {
  to: string
  customerName: string
  orderNumber: string
  total: number
  payUrl: string
}) {
  const html = layout('Selesaikan Pembayaran', `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hai <strong>${esc(params.customerName)}</strong>,</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827;">Pesanan anda hampir selesai ⏳</h1>

    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
      Kami perasan pesanan anda belum dibayar. Stok terhad — selesaikan pembayaran
      sekarang untuk pastikan pesanan anda dikunci.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <tr>
        <td style="font-size:13px;color:#92400e;">No. Pesanan</td>
        <td style="font-size:14px;font-weight:700;color:#92400e;text-align:right;">${esc(params.orderNumber)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#92400e;padding-top:6px;">Jumlah Perlu Dibayar</td>
        <td style="font-size:16px;font-weight:800;color:#b45309;text-align:right;padding-top:6px;">RM${Number(params.total).toFixed(2)}</td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${params.payUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
          💳 Bayar Sekarang
        </a>
      </td></tr>
    </table>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      Sudah membayar? Abaikan email ini.<br/>
      Ada masalah pembayaran? Hubungi kami via WhatsApp.
    </p>
  `)

  await send({
    from: FROM_ORDER,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.customerName,
    subject: `⏳ Selesaikan pembayaran pesanan ${params.orderNumber} — SyababFresh`,
    html,
  })
}

// ─── email 6: broadcast CRM (mesej bebas admin → balut brand) ──────────────────
// Mesej ditaip admin (teks biasa, {nama} sudah digantikan oleh pemanggil). Kita
// esc + tukar newline ke <br>, balut dalam layout() berbrand. Guna FROM_NOREPLY.
// Pulang true bila berjaya supaya broadcast boleh kira sent/failed.
export async function sendBroadcastEmail(params: {
  to: string
  toName: string | null
  subject: string
  message: string
}): Promise<boolean> {
  const bodyHtml = esc(params.message).replace(/\n/g, '<br/>')
  const html = layout(params.subject, `
    <div style="font-size:14px;color:#374151;line-height:1.7;">${bodyHtml}</div>
  `)
  return send({
    from: FROM_NOREPLY,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.toName ?? 'Pelanggan',
    subject: params.subject,
    html,
  })
}

// ─── email 7: invois reseller (PDF attachment) ─────────────────────────────────
export async function sendResellerInvoiceEmail(params: {
  to: string
  toName: string | null
  invoiceNumber: string
  total: number
  pdfBase64: string
}): Promise<boolean> {
  const html = layout(`Invois ${params.invoiceNumber}`, `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hai <strong>${esc(params.toName ?? 'Reseller')}</strong>,</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">Invois ${esc(params.invoiceNumber)}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      Terlampir invois borong anda. Jumlah: <strong>RM${Number(params.total).toFixed(2)}</strong>.
      Terima kasih atas pesanan anda. 🍒
    </p>
  `)
  return send({
    from: FROM_ORDER,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.toName ?? 'Reseller',
    subject: `Invois ${params.invoiceNumber} — SyababFresh`,
    html,
    attachments: [{ name: `${params.invoiceNumber}.pdf`, contentBase64: params.pdfBase64, mimeType: 'application/pdf' }],
  })
}

// Invois untuk customer biasa (bukan reseller) — teks am.
export async function sendCustomerInvoiceEmail(params: {
  to: string
  toName: string | null
  invoiceNumber: string
  total: number
  pdfBase64: string
}): Promise<boolean> {
  const html = layout(`Invois ${params.invoiceNumber}`, `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hai <strong>${esc(params.toName ?? 'Pelanggan')}</strong>,</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">Invois ${esc(params.invoiceNumber)}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      Terlampir invois untuk pesanan anda. Jumlah: <strong>RM${Number(params.total).toFixed(2)}</strong>.
      Terima kasih atas pesanan anda. 🍒
    </p>
  `)
  return send({
    from: FROM_ORDER,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.toName ?? 'Pelanggan',
    subject: `Invois ${params.invoiceNumber} — SyababFresh`,
    html,
    attachments: [{ name: `${params.invoiceNumber}.pdf`, contentBase64: params.pdfBase64, mimeType: 'application/pdf' }],
  })
}

// ─── email 9: peringatan voucher hampir luput (Tier 2.2) ───────────────────────
// Voucher peribadi (welcome / kad setia) belum ditebus & luput ≤7 hari.
// Sekali sahaja per voucher (cron stamp reminder_sent_at).
export async function sendVoucherReminderEmail(params: {
  to: string
  customerName: string
  code: string
  value: number      // RM (type fixed)
  minOrder: number
  expiresAt: string  // ISO
}) {
  const tarikh = new Date(params.expiresAt).toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' })
  const html = layout('Voucher Anda Hampir Luput', `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hai <strong>${esc(params.customerName)}</strong>,</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827;">Voucher RM${Number(params.value).toFixed(2)} anda luput ${esc(tarikh)} ⏳</h1>

    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
      Jangan biar ia terbakar — voucher ini milik anda dan boleh terus digunakan
      di checkout${params.minOrder > 0 ? ` (pembelian minimum RM${Number(params.minOrder).toFixed(2)})` : ''}.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:2px dashed #10b981;border-radius:12px;padding:16px;margin-bottom:24px;">
      <tr><td align="center">
        <div style="font-size:12px;color:#047857;margin-bottom:4px;">Kod voucher anda</div>
        <div style="font-size:24px;font-weight:800;letter-spacing:3px;color:#065f46;">${esc(params.code)}</div>
        <div style="font-size:13px;color:#047857;margin-top:4px;">Diskaun RM${Number(params.value).toFixed(2)} · sah sehingga ${esc(tarikh)}</div>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'}/products" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
          🍒 Guna Voucher Sekarang
        </a>
      </td></tr>
    </table>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      Voucher dimasukkan automatik di checkout bila anda log masuk.
    </p>
  `)

  await send({
    from: FROM_NOREPLY,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.customerName,
    subject: `⏳ Voucher RM${Number(params.value).toFixed(2)} anda luput ${tarikh} — jangan terlepas`,
    html,
  })
}

// ─── email 10: jemput ulasan selepas delivered (baki Tier 1.1) ─────────────────
// Member sahaja (ulasan perlukan akaun). Sekali per order
// (orders.review_request_sent_at). CTA terus ke page produk (seksyen ulasan).
export async function sendReviewRequestEmail(params: {
  to: string
  customerName: string
  orderNumber: string
  items: { name: string; slug: string | null }[]
}) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'
  const rows = params.items.slice(0, 3).map((i) => `
    <tr><td style="padding:6px 0;">
      <a href="${base}${i.slug ? `/products/${i.slug}` : '/products'}" style="display:block;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;text-decoration:none;">
        <span style="font-size:14px;font-weight:700;color:#111827;">${esc(i.name)}</span>
        <span style="float:right;font-size:13px;font-weight:700;color:#16a34a;">Beri ulasan ⭐</span>
      </a>
    </td></tr>`).join('')

  const html = layout('Macam Mana Buah Anda?', `
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hai <strong>${esc(params.customerName)}</strong>,</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827;">Dah rasa? Kongsi pendapat anda 🍒</h1>

    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
      Pesanan <strong>${esc(params.orderNumber)}</strong> anda dah selamat sampai.
      Ulasan ikhlas anda membantu pelanggan lain pilih buah terbaik — dan membantu
      kami kekalkan kualiti.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">${rows}</table>

    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
      Log masuk & tekan "Tulis Ulasan" di page produk. Terima kasih! 💚
    </p>
  `)

  await send({
    from: FROM_NOREPLY,
    fromName: 'SyababFresh',
    to: params.to,
    toName: params.customerName,
    subject: `Macam mana buah anda? Kongsi ulasan — ${params.orderNumber}`,
    html,
  })
}
