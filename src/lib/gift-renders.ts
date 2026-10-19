// Render AI (ChatGPT, 15 Okt 2026) daripada ARTWORK SEBENAR klien — BUKAN foto kotak yang dihantar.
// Guna untuk visual hero / strip "Design yang kami hasilkan" / OG image dengan label "visual render".
// JANGAN masuk seksyen yang berjanji "foto sebenar" (/korporat "Kerja kami", /portfolio).
// Fail asal: ~/gift kurma/ChatGPT Image *.png → WebP q84–88 di public/kurma/renders (sharp, tiada upscale).
// Dikecualikan atas arahan/prinsip pemilik: tokoh politik (#5, #13), Tasneem Dates (#12, belum disahkan),
// Rayyan (#18, logo kurang tepat). Pendua (#7/#9, #8/#10/#16, #2/#15) — satu sahaja dipilih.
export const RENDER_NOTE = 'Visual render daripada artwork sebenar klien — bukan foto produk.'

export const RENDER_HERO = {
  src: '/kurma/renders/koleksi-hero.webp',
  srcSet: '/kurma/renders/koleksi-hero-640.webp 640w, /kurma/renders/koleksi-hero.webp 1122w',
  width: 1122,
  height: 1402,
  alt: 'Koleksi gift box kurma custom — BPMB, Hertz / Thrifty dan reka bentuk Ramadan lain (visual render)',
  /** Laluan fail dari root projek — untuk OG image (dibaca di server, bukan URL). */
  file: 'public/kurma/renders/koleksi-hero.webp',
}

export interface DesignRender { slug: string; src: string; label: string; client: string | null }

export const DESIGN_RENDERS: DesignRender[] = [
  { slug: 'bpmb', src: '/kurma/renders/render-bpmb.webp', label: 'BPMB — ulang tahun ke-50', client: 'BPMB' },
  { slug: 'jkim', src: '/kurma/renders/render-jkim.webp', label: 'JKIM — arabesque hijau', client: 'JKIM' },
  { slug: 'roland', src: '/kurma/renders/render-roland.webp', label: 'Roland — hijau emas', client: 'Roland' },
  { slug: 'aerotree', src: '/kurma/renders/render-aerotree.webp', label: 'Aerotree — biru malam', client: 'Aerotree Defence & Services' },
  { slug: 'suci-vision', src: '/kurma/renders/render-suci-vision.webp', label: 'Suci Vision — kuning', client: 'Suci Vision' },
  { slug: 'mandala-ungu', src: '/kurma/renders/render-mandala-ungu.webp', label: 'Mandala ungu', client: null },
  { slug: 'arabesque-oren', src: '/kurma/renders/render-arabesque-oren.webp', label: 'Arabesque oren', client: null },
  { slug: 'mandala-pastel', src: '/kurma/renders/render-mandala-pastel.webp', label: 'Mandala pastel', client: null },
]
