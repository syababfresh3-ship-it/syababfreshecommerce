import { ImageResponse } from 'next/og'

// Penjana OG image 1200×630 untuk LP kurma (preview pautan FB).
// Teks sahaja (jenama) — ringkas & pasti, tiada font luar diperlukan.
export function kurmaOg(headline: string, sub: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#1F2937', padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', background: '#E11D2A', color: '#fff', fontSize: '24px', fontWeight: 700, padding: '10px 20px', borderRadius: '999px' }}>SyababFresh</div>
          <div style={{ display: 'flex', color: '#9CA3AF', fontSize: '24px' }}>Custom Gift Box Kurma</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: '#ffffff', fontSize: '64px', fontWeight: 800, lineHeight: 1.1, maxWidth: '1000px' }}>{headline}</div>
          {sub ? <div style={{ display: 'flex', color: '#D1D5DB', fontSize: '28px', marginTop: '24px', maxWidth: '940px', lineHeight: 1.35 }}>{sub}</div> : <div />}
        </div>
        <div style={{ display: 'flex', color: '#9CA3AF', fontSize: '22px' }}>Termasuk kurma · Design percuma · Seluruh Malaysia · WhatsApp 011-5640 3601</div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
