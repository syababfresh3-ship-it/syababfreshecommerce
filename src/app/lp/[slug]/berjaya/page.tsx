import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { LpPaymentVerifier } from './lp-payment-verifier'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Pembayaran Berjaya — SyababFresh' }

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ pesanan?: string }> }

export default async function ThankYouPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { pesanan } = await searchParams

  const supabase = createAdminClient()

  // Fetch LP page for meta pixel + branding
  const { data: page } = await supabase
    .from('landing_pages')
    .select('title, meta_pixel_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!page) notFound()

  // Fetch order details
  const order = pesanan ? await supabase
    .from('lp_guest_orders')
    .select('id, status, order_number, name, phone, total, delivery_fee, payment_method, items, product_name, variant_name, quantity, unit_price')
    .eq('order_number', pesanan)
    .single()
    .then(r => r.data) : null

  const items: any[] = Array.isArray(order?.items) && order.items.length > 0
    ? order.items
    : order ? [{ product_name: order.product_name, variant_name: order.variant_name, quantity: order.quantity, unit_price: order.unit_price }]
    : []

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Confirm FPX payment directly with CHIP if the webhook hasn't landed yet */}
      {order && order.status === 'pending' && ['fpx', 'ewallet'].includes(order.payment_method) && (
        <LpPaymentVerifier orderId={order.id} />
      )}

      {/* Meta Pixel */}
      {page.meta_pixel_id && (
        <script dangerouslySetInnerHTML={{ __html: `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${page.meta_pixel_id}');
          fbq('track', 'Purchase', { value: ${order?.total ?? 0}, currency: 'MYR' });
        ` }} />
      )}

      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 480, margin: '0 auto' }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 18, color: '#16a34a', textDecoration: 'none' }}>SyababFresh</Link>
        <Link href={`/lp/${slug}`} style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← Kembali</Link>
      </header>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Success card */}
        <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.10)', marginBottom: 20 }}>
          {/* Hero */}
          <div style={{ background: 'linear-gradient(135deg, #9C0F30 0%, #BE1540 100%)', padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>
              ✅
            </div>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: '#fff', marginBottom: 6 }}>Pembayaran Berjaya!</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>Bayaran FPX anda telah diterima &amp; disahkan</p>
          </div>

          {/* Order details */}
          <div style={{ background: '#fff', padding: '24px 20px' }}>
            {order ? (
              <>
                <div style={{ background: '#fef2f2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
                    <span>No. Pesanan</span>
                    <span style={{ fontWeight: 900, fontFamily: 'monospace', color: '#9C0F30', fontSize: 14 }}>{order.order_number}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
                    <span>Nama</span>
                    <span style={{ fontWeight: 700, color: '#111' }}>{order.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
                    <span>No. Telefon</span>
                    <span style={{ fontWeight: 700, color: '#111' }}>{order.phone}</span>
                  </div>
                  <div style={{ borderTop: '1px solid #fecaca', paddingTop: 10, marginTop: 4 }}>
                    {items.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: i < items.length - 1 ? 6 : 0 }}>
                        <span style={{ color: '#374151' }}>{item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ''} × {item.quantity}</span>
                        <span style={{ fontWeight: 700, color: '#111' }}>RM{(Number(item.unit_price) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {Number(order.delivery_fee) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, color: '#6b7280' }}>
                      <span>Penghantaran</span>
                      <span style={{ fontWeight: 600 }}>RM{Number(order.delivery_fee).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #fecaca', paddingTop: 10, marginTop: 10, fontWeight: 900, fontSize: 17 }}>
                    <span>Jumlah Dibayar</span>
                    <span style={{ color: '#9C0F30' }}>RM{Number(order.total).toFixed(2)}</span>
                  </div>
                </div>

                {/* Next steps */}
                <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '14px 16px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
                  <p style={{ fontWeight: 800, marginBottom: 6 }}>Apa seterusnya?</p>
                  <p style={{ lineHeight: 1.6 }}>✅ Bayaran FPX diterima. Pesanan anda sedang diproses &amp; akan dihantar mengikut jadual. Team kami akan hubungi anda untuk update penghantaran.</p>
                </div>

                {/* Official receipt — LP guests have no /orders page, so this is their access point */}
                <a href={`/resit/${order.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', background: '#16a34a', color: '#fff', borderRadius: 14, fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box' }}>
                  📄 Lihat / Muat Turun Resit Rasmi
                </a>

                {/* Register CTA */}
                <a href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'}/daftar`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', background: '#9C0F30', color: '#fff', borderRadius: 14, fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box' }}>
                  🎁 Daftar Akaun — Dapat Loyalty Points &amp; Track Order
                </a>

                {/* WhatsApp button */}
                <WaButton order={order} items={items} />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#6b7280', fontSize: 14 }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>🎉</p>
                <p>Pembayaran anda telah diterima. Team kami akan menghubungi anda tidak lama lagi.</p>
              </div>
            )}
          </div>
        </div>

        {/* Back to LP */}
        <Link href={`/lp/${slug}`} style={{ display: 'block', textAlign: 'center', fontSize: 14, color: '#9ca3af', textDecoration: 'none', padding: '12px' }}>
          ← Kembali ke halaman produk
        </Link>
      </div>
    </div>
  )
}

// Client component for WhatsApp (needs window)
function WaButton({ order, items }: { order: any; items: any[] }) {
  const itemLines = items.map((i: any) =>
    `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} × ${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`
  ).join('\n')

  const msg = encodeURIComponent(
    `Assalamualaikum! Saya ingin sahkan pesanan:\n\n${itemLines}\n\n` +
    `🔢 No. Pesanan: *${order.order_number}*\n` +
    `💰 Jumlah: *RM${Number(order.total).toFixed(2)}*\n` +
    `💳 Bayaran: FPX ✅ Dibayar\n\nTerima kasih!`
  )

  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? ''
  return (
    <a href={`https://wa.me/${waNumber}?text=${msg}`} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', background: '#25D366', color: '#fff', borderRadius: 14, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxSizing: 'border-box' }}>
      💬 Hantar Pengesahan via WhatsApp
    </a>
  )
}
