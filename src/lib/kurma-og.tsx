import { ImageResponse } from 'next/og'

// Satori hanya keluarkan PNG; OG berfoto jadi 375KB–1MB. WhatsApp (saluran utama sales kongsi pautan)
// kerap TAK papar thumbnail untuk imej >~300KB. Tukar ke JPEG (sharp) → ~100–200KB, kualiti kekal jelas.
// Route OG mesti set `contentType = 'image/jpeg'` bila guna ini.
export async function asJpeg(img: ImageResponse, quality = 85): Promise<Response> {
  const png = Buffer.from(await img.arrayBuffer())
  const sharp = (await import('sharp')).default
  const jpg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer()
  return new Response(new Uint8Array(jpg), { headers: { 'Content-Type': 'image/jpeg' } })
}

// Penjana OG image 1200×630 untuk LP kurma (preview pautan FB).
// Teks sahaja (jenama) — ringkas & pasti, tiada font luar diperlukan.
// `imageDataUrl` (pilihan, additive): foto kotak sebenar di kanan (LP korporat) — base64 data URL
// supaya Satori tak perlu fetch luar semasa build; tiada → layout teks sahaja seperti dulu.
// `opts.kicker/footer` (additive): LP borong tukar baris atas/bawah; lalai = teks gift box.
// `opts.photo` (additive): layout FOTO — imej 504×630 (data URL JPEG) memenuhi tinggi di kanan, gradien gelap
// dari kiri untuk teks; dipakai LP gift box (/ & angle) dgn render koleksi (lib/kurma-og-photo.ts).
export function kurmaOg(headline: string, sub: string, imageDataUrl?: string, opts: { kicker?: string; footer?: string; photo?: string } = {}) {
  const kicker = opts.kicker ?? 'Custom Gift Box Kurma'
  const footer = opts.footer ?? 'Termasuk kurma · Design percuma · Seluruh Malaysia · WhatsApp 011-5640 3601'
  if (opts.photo) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#1F2937', fontFamily: 'sans-serif' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={opts.photo} alt="" width={504} height={630} style={{ position: 'absolute', right: 0, top: 0, width: '504px', height: '630px', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: '1200px', height: '630px', display: 'flex', background: 'linear-gradient(90deg, #1F2937 0%, #1F2937 50%, rgba(31,41,55,0.0) 70%)' }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '1200px', height: '630px', padding: '64px 72px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', background: '#E11D2A', color: '#fff', fontSize: '24px', fontWeight: 700, padding: '10px 20px', borderRadius: '999px' }}>SyababFresh</div>
              <div style={{ display: 'flex', color: '#D1D5DB', fontSize: '24px' }}>{kicker}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', color: '#ffffff', fontSize: '58px', fontWeight: 800, lineHeight: 1.08, maxWidth: '640px' }}>{headline}</div>
              {sub ? <div style={{ display: 'flex', color: '#E5E7EB', fontSize: '25px', marginTop: '22px', maxWidth: '580px', lineHeight: 1.35 }}>{sub}</div> : <div />}
            </div>
            {/* maxWidth: kekal dalam kawasan gelap (gradien lut dari ~50%) — bungkus 2 baris, bukan terlanggar foto */}
            <div style={{ display: 'flex', color: '#D1D5DB', fontSize: '21px', lineHeight: 1.35, maxWidth: '560px' }}>{footer}</div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    )
  }
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
