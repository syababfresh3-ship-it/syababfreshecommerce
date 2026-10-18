import { ImageResponse } from 'next/og'

// Penjana OG image 1200×630 untuk LP kurma (preview pautan FB).
// Teks sahaja (jenama) — ringkas & pasti, tiada font luar diperlukan.
// `imageDataUrl` (pilihan, additive): foto kotak sebenar di kanan (LP korporat) — base64 data URL
// supaya Satori tak perlu fetch luar semasa build; tiada → layout teks sahaja seperti dulu.
// `opts.kicker/footer` (additive): LP borong tukar baris atas/bawah; lalai = teks gift box.
export function kurmaOg(headline: string, sub: string, imageDataUrl?: string, opts: { kicker?: string; footer?: string } = {}) {
  const kicker = opts.kicker ?? 'Custom Gift Box Kurma'
  const footer = opts.footer ?? 'Termasuk kurma · Design percuma · Seluruh Malaysia · WhatsApp 011-5640 3601'
  const textWidth = imageDataUrl ? '560px' : '1000px'
  const fontSize = imageDataUrl ? '52px' : '64px'
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#1F2937', padding: '72px',
          fontFamily: 'sans-serif', position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', background: '#E11D2A', color: '#fff', fontSize: '24px', fontWeight: 700, padding: '10px 20px', borderRadius: '999px' }}>SyababFresh</div>
          <div style={{ display: 'flex', color: '#9CA3AF', fontSize: '24px' }}>{kicker}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: '#ffffff', fontSize, fontWeight: 800, lineHeight: 1.1, maxWidth: textWidth }}>{headline}</div>
          {sub ? <div style={{ display: 'flex', color: '#D1D5DB', fontSize: '26px', marginTop: '24px', maxWidth: imageDataUrl ? '560px' : '940px', lineHeight: 1.35 }}>{sub}</div> : <div />}
        </div>
        <div style={{ display: 'flex', color: '#9CA3AF', fontSize: '22px' }}>{footer}</div>
        {imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageDataUrl} alt="" width={440} height={440} style={{ position: 'absolute', right: '72px', top: '95px', width: '440px', height: '440px', borderRadius: '24px', objectFit: 'cover' }} />
        ) : null}
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
