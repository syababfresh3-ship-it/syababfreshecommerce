import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FRAMEWORKS: Record<string, { name: string; description: string; prompt: string }> = {
  aida: {
    name: 'AIDA',
    description: 'Attention → Interest → Desire → Action',
    prompt: `Guna framework AIDA:
- ATTENTION: Hero section yang menarik perhatian serta-merta — headline bold, gambar placeholder, urgency badge
- INTEREST: Fakta menarik, cerita produk, kenapa produk ini istimewa
- DESIRE: Manfaat spesifik, testimonial 2 pelanggan, social proof, scarcity
- ACTION: Product card placeholder + lead form`,
  },
  pas: {
    name: 'PAS',
    description: 'Problem → Agitate → Solution',
    prompt: `Guna framework PAS:
- PROBLEM: Kenal pasti masalah atau keperluan pelanggan yang berkaitan produk ini
- AGITATE: Perbesarkan masalah — tunjukkan akibat jika masalah tidak diselesaikan, buat pembaca rasa urgen
- SOLUTION: Tunjukkan produk sebagai penyelesaian terbaik dengan bukti dan manfaat
- CTA: Product card placeholder + lead form`,
  },
  bab: {
    name: 'BAB',
    description: 'Before → After → Bridge',
    prompt: `Guna framework BAB:
- BEFORE: Lukiskan situasi pelanggan sekarang — keadaan yang kurang memuaskan sebelum ada produk ini
- AFTER: Gambaran kehidupan yang lebih baik selepas guna produk — emosi, manfaat, perubahan positif
- BRIDGE: Tunjukkan produk sebagai jambatan dari Before ke After, dengan cara yang jelas dan meyakinkan
- CTA: Product card placeholder + lead form`,
  },
  fab: {
    name: 'FAB',
    description: 'Features → Advantages → Benefits',
    prompt: `Guna framework FAB:
- FEATURES: Ciri-ciri spesifik produk (apa yang ada)
- ADVANTAGES: Kelebihan berbanding produk lain (kenapa ciri ini penting)
- BENEFITS: Manfaat sebenar kepada pelanggan (apa yang pelanggan dapat/rasa)
- Susun dalam grid atau senarai yang menarik
- CTA: Product card placeholder + lead form`,
  },
  pastor: {
    name: 'PASTOR',
    description: 'Problem → Amplify → Story → Transformation → Offer → Response',
    prompt: `Guna framework PASTOR:
- PROBLEM: Masalah utama pelanggan
- AMPLIFY: Perbesarkan kesan masalah jika tidak diselesaikan
- STORY: Cerita pelanggan yang berjaya — boleh guna nama rekaan (testimoni style)
- TRANSFORMATION: Perubahan yang berlaku selepas guna produk
- OFFER: Tunjukkan produk dengan nilai yang jelas
- RESPONSE: CTA yang kuat — product card placeholder + lead form`,
  },
  '4ps': {
    name: '4Ps',
    description: 'Promise → Picture → Proof → Push',
    prompt: `Guna framework 4Ps:
- PROMISE: Janji utama produk — satu ayat yang kuat dan spesifik
- PICTURE: Gambaran vivid tentang pengalaman atau hasil menggunakan produk — buat pembaca bayangkan
- PROOF: Bukti kukuh — testimoni, fakta, nombor, atau jaminan
- PUSH: Dorongan untuk bertindak sekarang — urgency, scarcity, atau offer terhad
- CTA: Product card placeholder + lead form`,
  },
}

const THEMES: Record<string, { name: string; emoji: string; colors: string; bg: string; preview: string }> = {
  purple: {
    name: 'Royal Purple',
    emoji: '💜',
    preview: '#7c3aed',
    bg: '#faf5ff',
    colors: `Primary: #7c3aed, #6d28d9, #581c87 | Background: #faf5ff, #f5f3ff | Accent: #ddd6fe | Text: #1c1917 | Hero gradient: linear-gradient(160deg, #1a0a2e, #3b1f6b, #6d28d9)`,
  },
  green: {
    name: 'Fresh Green',
    emoji: '💚',
    preview: '#16a34a',
    bg: '#f0fdf4',
    colors: `Primary: #16a34a, #15803d, #166534 | Background: #f0fdf4, #dcfce7 | Accent: #bbf7d0 | Text: #14532d | Hero gradient: linear-gradient(160deg, #052e16, #14532d, #16a34a)`,
  },
  gold: {
    name: 'Gold Premium',
    emoji: '✨',
    preview: '#d97706',
    bg: '#fffbeb',
    colors: `Primary: #d97706, #b45309, #92400e | Background: #fffbeb, #fef3c7 | Accent: #fde68a | Text: #1c1917 | Hero gradient: linear-gradient(160deg, #1c1205, #451a03, #92400e)`,
  },
  red: {
    name: 'Bold Red',
    emoji: '❤️',
    preview: '#dc2626',
    bg: '#fff1f2',
    colors: `Primary: #dc2626, #b91c1c, #991b1b | Background: #fff1f2, #fee2e2 | Accent: #fecaca | Text: #1c1917 | Hero gradient: linear-gradient(160deg, #1f0505, #450a0a, #991b1b)`,
  },
  dark: {
    name: 'Dark Minimal',
    emoji: '🖤',
    preview: '#171717',
    bg: '#fafafa',
    colors: `Primary: #171717, #262626, #404040 | Background: #fafafa, #f5f5f5 | Accent: #d4d4d4 | Text: #171717 | Hero gradient: linear-gradient(160deg, #000000, #171717, #262626) | Button: background #171717, color white`,
  },
  ocean: {
    name: 'Ocean Blue',
    emoji: '💙',
    preview: '#0284c7',
    bg: '#f0f9ff',
    colors: `Primary: #0284c7, #0369a1, #075985 | Background: #f0f9ff, #e0f2fe | Accent: #bae6fd | Text: #0c4a6e | Hero gradient: linear-gradient(160deg, #082f49, #0c4a6e, #0369a1)`,
  },
  coral: {
    name: 'Coral Warm',
    emoji: '🧡',
    preview: '#ea580c',
    bg: '#fff7ed',
    colors: `Primary: #ea580c, #c2410c, #9a3412 | Background: #fff7ed, #ffedd5 | Accent: #fed7aa | Text: #1c1917 | Hero gradient: linear-gradient(160deg, #2c0a00, #7c2d12, #c2410c)`,
  },
  rose: {
    name: 'Rose Pink',
    emoji: '🌸',
    preview: '#e11d48',
    bg: '#fff1f2',
    colors: `Primary: #e11d48, #be123c, #9f1239 | Background: #fff1f2, #ffe4e6 | Accent: #fecdd3 | Text: #1c1917 | Hero gradient: linear-gradient(160deg, #3f0025, #881337, #be123c)`,
  },
}

const SYSTEM_PROMPT = `Kamu adalah pakar copywriting landing page untuk e-commerce Malaysia.
Tulis HTML landing page dalam Bahasa Malaysia yang menarik, emosional, dan tinggi konversi.

PERATURAN WAJIB:
1. Output HANYA HTML dengan inline styles sahaja — tiada CSS class external, tiada JavaScript
2. Guna WARNA TEMA yang diberikan dalam user prompt — WAJIB ikut tema yang dipilih
3. Semua div, section, text mesti ada inline style yang lengkap
4. Guna emoji secara strategik untuk menarik perhatian
5. Setiap bahagian gambar, tulis: <img src="UPLOAD_GAMBAR_DI_SINI" alt="..." style="width:100%; border-radius:16px; margin:12px 0;" />
6. Tempat produk: tulis {{product:SLUG_PRODUK}} — ganti SLUG_PRODUK dengan slug sebenar yang diberi
7. Tempat lead form: tulis {{lead-form}}
8. Mobile-first — font size 14-32px, padding 16-24px, tidak lebih
9. Jangan buat page terlalu panjang — medium length, padat dan berkesan
10. Tiada lorem ipsum — semua teks mesti relevan dan spesifik kepada produk`

export async function POST(request: Request) {
  const { forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json().catch(() => ({}))
  const { framework, theme = 'green', product_name, product_slug, target_audience, campaign_goal, tone, product_price } = body

  if (!framework || !FRAMEWORKS[framework])
    return NextResponse.json({ error: 'Framework tidak sah' }, { status: 400 })
  if (!product_name || typeof product_name !== 'string')
    return NextResponse.json({ error: 'Nama produk diperlukan' }, { status: 400 })

  const fw = FRAMEWORKS[framework]
  const th = THEMES[theme] ?? THEMES.green

  const toneMap: Record<string, string> = {
    casual: 'santai, mesra, seperti kawan bercakap',
    professional: 'profesional, dipercayai, authoritative',
    urgent: 'urgent, FOMO, scarcity tinggi — buat pembaca rasa perlu beli sekarang',
    emotional: 'emosional, cerita peribadi, menyentuh hati',
  }

  const userPrompt = `
Cipta landing page HTML menggunakan framework ${fw.name}.

MAKLUMAT PRODUK:
- Nama produk: ${product_name}
- Slug produk: ${product_slug || product_name.toLowerCase().replace(/\s+/g, '-')}
- Harga: ${product_price ? `RM${product_price}` : 'tidak dinyatakan'}
- Target pelanggan: ${target_audience || 'umum'}
- Tujuan kempen: ${campaign_goal || 'tingkatkan jualan'}
- Tone: ${toneMap[tone] || toneMap.casual}

TEMA WARNA — ${th.name} ${th.emoji}:
${th.colors}
WAJIB guna warna tema ini di seluruh page. Hero section MESTI guna hero gradient tema ini.

FRAMEWORK ${fw.name.toUpperCase()} — ${fw.description}:
${fw.prompt}

Tulis HTML lengkap sekarang. Ingat: inline styles sahaja, guna {{product:${product_slug || 'slug-produk'}}} untuk product card, dan {{lead-form}} untuk form kenalan.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text')
      return NextResponse.json({ error: 'Gagal jana kandungan' }, { status: 500 })

    // Strip markdown code blocks if Claude wrapped it
    let html = content.text.trim()
    html = html.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '').trim()

    return NextResponse.json({ html, framework: fw.name })
  } catch (err: any) {
    console.error('Claude API error:', err)
    return NextResponse.json({ error: err.message ?? 'Gagal hubungi AI' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    frameworks: Object.entries(FRAMEWORKS).map(([id, fw]) => ({
      id, name: fw.name, description: fw.description,
    })),
    themes: Object.entries(THEMES).map(([id, th]) => ({
      id, name: th.name, emoji: th.emoji, preview: th.preview, bg: th.bg,
    })),
  })
}
