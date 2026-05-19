// ============================================================
// LP Section Builder — types + HTML generator
// ============================================================

export type SectionType =
  | 'hero'
  | 'text'
  | 'benefits'
  | 'product'
  | 'testimonial'
  | 'urgency'
  | 'lead-form'
  | 'image'
  | 'cta-button'
  | 'faq'
  | 'stats'
  | 'countdown'

export interface Section {
  id: string
  type: SectionType
  data: Record<string, string>
}

export const SECTION_META: Record<SectionType, { label: string; icon: string; defaultData: Record<string, string> }> = {
  hero: {
    label: 'Hero / Header',
    icon: '🏆',
    defaultData: {
      badge: '',
      headline: '',
      subheadline: '',
      body: '',
    },
  },
  text: {
    label: 'Teks / Paragraf',
    icon: '📝',
    defaultData: {
      title: '',
      body: '',
      align: 'left',
    },
  },
  benefits: {
    label: 'Senarai Manfaat',
    icon: '✅',
    defaultData: {
      title: 'Kenapa Pilih Kami?',
      item1_emoji: '⭐',
      item1_title: '',
      item1_desc: '',
      item2_emoji: '🚀',
      item2_title: '',
      item2_desc: '',
      item3_emoji: '💎',
      item3_title: '',
      item3_desc: '',
      item4_emoji: '🔒',
      item4_title: '',
      item4_desc: '',
    },
  },
  product: {
    label: 'Produk',
    icon: '🛍️',
    defaultData: {
      slug: '',
    },
  },
  testimonial: {
    label: 'Testimoni',
    icon: '💬',
    defaultData: {
      quote: '',
      name: '',
      location: '',
      rating: '5',
    },
  },
  urgency: {
    label: 'Banner Urgent',
    icon: '⏰',
    defaultData: {
      emoji: '🔥',
      text: 'Stok terhad — order sekarang!',
    },
  },
  'lead-form': {
    label: 'Form Kenalan',
    icon: '📩',
    defaultData: {
      title: 'Ada soalan? Kami sedia membantu!',
      desc: 'Tinggalkan nombor anda — team kami hubungi dalam masa 24 jam.',
      ty_title: 'Terima kasih!',
      ty_message: 'Team kami akan hubungi anda tidak lama lagi.',
      ty_wa_link: '',
      ty_redirect: '',
    },
  },
  image: {
    label: 'Gambar',
    icon: '🖼️',
    defaultData: {
      alt: '',
      caption: '',
    },
  },
  'cta-button': {
    label: 'CTA Button',
    icon: '🔘',
    defaultData: {
      text: 'Beli Sekarang',
      link: '/products',
      style: 'green',
      size: 'large',
      sub: '',
    },
  },
  faq: {
    label: 'Soalan Lazim (FAQ)',
    icon: '❓',
    defaultData: {
      title: 'Soalan Lazim',
      q1: '', a1: '',
      q2: '', a2: '',
      q3: '', a3: '',
      q4: '', a4: '',
      q5: '', a5: '',
    },
  },
  stats: {
    label: 'Statistik / Nombor',
    icon: '📊',
    defaultData: {
      title: '',
      stat1_num: '', stat1_label: '',
      stat2_num: '', stat2_label: '',
      stat3_num: '', stat3_label: '',
      stat4_num: '', stat4_label: '',
    },
  },
  countdown: {
    label: 'Countdown Timer',
    icon: '⏱️',
    defaultData: {
      title: 'Tawaran tamat dalam:',
      end_datetime: '',
      expired_text: 'Tawaran telah tamat',
    },
  },
}

export function newSection(type: SectionType): Section {
  return {
    id: Math.random().toString(36).slice(2, 9),
    type,
    data: { ...SECTION_META[type].defaultData },
  }
}

// ── HTML generators per section type ──────────────────────

function stars(n: number) {
  return '★'.repeat(Math.min(5, Math.max(1, n))) + '☆'.repeat(5 - Math.min(5, Math.max(1, n)))
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function sectionHero(d: Record<string, string>): string {
  return `
<div style="padding: 36px 0 8px; text-align: center;">
  ${d.badge ? `<div style="display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; border: 1px solid #bbf7d0; color: #15803d; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; padding: 5px 14px; border-radius: 999px; margin-bottom: 16px; text-transform: uppercase;">${escHtml(d.badge)}</div>` : ''}
  ${d.headline ? `<h1 style="font-size: 30px; font-weight: 900; color: #1c1917; margin: 0 0 12px; line-height: 1.15; letter-spacing: -0.02em;">${escHtml(d.headline)}</h1>` : ''}
  ${d.subheadline ? `<p style="font-size: 17px; font-weight: 700; color: #16a34a; margin: 0 0 10px;">${escHtml(d.subheadline)}</p>` : ''}
  ${d.body ? `<p style="font-size: 14px; color: #78716c; margin: 0; line-height: 1.7;">${escHtml(d.body)}</p>` : ''}
</div>`.trim()
}

function sectionText(d: Record<string, string>): string {
  const align = d.align === 'center' ? 'center' : 'left'
  return `
<div style="padding: 12px 0; text-align: ${align};">
  ${d.title ? `<h2 style="font-size: 20px; font-weight: 900; color: #1c1917; margin: 0 0 10px;">${escHtml(d.title)}</h2>` : ''}
  ${d.body ? `<p style="font-size: 14px; color: #57534e; line-height: 1.8; margin: 0;">${escHtml(d.body).replace(/\n/g, '<br/>')}</p>` : ''}
</div>`.trim()
}

function sectionBenefits(d: Record<string, string>): string {
  const items = [1, 2, 3, 4]
    .map(i => ({ emoji: d[`item${i}_emoji`], title: d[`item${i}_title`], desc: d[`item${i}_desc`] }))
    .filter(it => it.title)

  if (!items.length) return ''

  const cols = items.length <= 2 ? items.length : 2

  return `
<div style="padding: 16px 0 8px;">
  ${d.title ? `<h3 style="font-size: 18px; font-weight: 900; color: #1c1917; text-align: center; margin: 0 0 16px;">${escHtml(d.title)}</h3>` : ''}
  <div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 10px;">
    ${items.map(it => `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 16px 12px; text-align: center;">
      <div style="font-size: 26px; margin-bottom: 6px;">${it.emoji || '✅'}</div>
      <p style="font-size: 12px; font-weight: 800; color: #14532d; margin: 0 0 4px;">${escHtml(it.title)}</p>
      ${it.desc ? `<p style="font-size: 11px; color: #16a34a; margin: 0;">${escHtml(it.desc)}</p>` : ''}
    </div>`).join('')}
  </div>
</div>`.trim()
}

function sectionProduct(d: Record<string, string>): string {
  if (!d.slug) return '<!-- Pilih produk -->'
  return `{{product:${d.slug}}}`
}

function sectionTestimonial(d: Record<string, string>): string {
  if (!d.quote) return ''
  const rating = parseInt(d.rating || '5')
  return `
<div style="background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; margin: 8px 0; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
  <div style="color: #f59e0b; font-size: 14px; margin-bottom: 8px;">${stars(rating)}</div>
  <p style="font-size: 13px; color: #44403c; line-height: 1.7; margin: 0 0 12px; font-style: italic;">"${escHtml(d.quote)}"</p>
  <div style="display: flex; align-items: center; gap: 10px;">
    <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #16a34a, #22c55e); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: 800;">${(d.name || '?')[0].toUpperCase()}</div>
    <div>
      ${d.name ? `<p style="font-size: 12px; font-weight: 700; color: #1c1917; margin: 0;">${escHtml(d.name)}</p>` : ''}
      ${d.location ? `<p style="font-size: 11px; color: #a8a29e; margin: 0;">${escHtml(d.location)}</p>` : ''}
    </div>
  </div>
</div>`.trim()
}

function sectionUrgency(d: Record<string, string>): string {
  return `
<div style="background: #fef3c7; border: 2px solid #fde68a; border-radius: 14px; padding: 14px 16px; margin: 8px 0; display: flex; align-items: center; gap: 12px;">
  <span style="font-size: 24px; flex-shrink: 0;">${d.emoji || '⏰'}</span>
  <p style="font-size: 13px; font-weight: 800; color: #92400e; margin: 0;">${escHtml(d.text || '')}</p>
</div>`.trim()
}

function sectionLeadForm(d: Record<string, string>): string {
  const tyTitle = d.ty_title || 'Terima kasih!'
  const tyMessage = d.ty_message || 'Team kami akan hubungi anda tidak lama lagi.'
  const tyWaLink = d.ty_wa_link || ''
  const tyRedirect = d.ty_redirect || ''
  return `
<div style="margin: 16px 0 8px; text-align: center;">
  ${d.title ? `<p style="font-size: 15px; font-weight: 800; color: #1c1917; margin: 0 0 6px;">${escHtml(d.title)}</p>` : ''}
  ${d.desc ? `<p style="font-size: 13px; color: #78716c; margin: 0 0 16px;">${escHtml(d.desc)}</p>` : ''}
</div>
{{lead-form:${tyTitle}|${tyMessage}|${tyWaLink}|${tyRedirect}}}`.trim()
}

function sectionImage(d: Record<string, string>): string {
  return `<img src="UPLOAD_GAMBAR_DI_SINI" alt="${escHtml(d.alt || '')}" style="width:100%; border-radius:16px; margin:12px 0;" />${d.caption ? `\n<p style="font-size: 11px; color: #a8a29e; text-align: center; margin: -4px 0 8px;">${escHtml(d.caption)}</p>` : ''}`
}

function sectionCtaButton(d: Record<string, string>): string {
  const isWa = d.style === 'whatsapp'
  const isSm = d.size === 'small'
  const bg   = isWa ? '#25d366' : '#16a34a'
  const shadow = isWa ? '0 4px 14px rgba(37,211,102,0.4)' : '0 4px 14px rgba(22,163,74,0.4)'
  const fontSize = isSm ? '14px' : '17px'
  const padding  = isSm ? '12px 28px' : '16px 40px'
  const prefix   = isWa ? '💬 ' : ''
  return `
<div style="text-align: center; padding: 12px 0;">
  <a href="${escHtml(d.link || '/products')}" style="display: inline-block; background: ${bg}; color: white; font-size: ${fontSize}; font-weight: 900; padding: ${padding}; border-radius: 999px; text-decoration: none; box-shadow: ${shadow}; letter-spacing: -0.01em;">${prefix}${escHtml(d.text || 'Beli Sekarang')}</a>
  ${d.sub ? `<p style="font-size: 11px; color: #a8a29e; margin: 8px 0 0;">${escHtml(d.sub)}</p>` : ''}
</div>`.trim()
}

function sectionFaq(d: Record<string, string>): string {
  const items = [1,2,3,4,5]
    .map(i => ({ q: d[`q${i}`], a: d[`a${i}`] }))
    .filter(x => x.q && x.a)
  if (!items.length) return ''
  return `
<div style="padding: 12px 0;">
  ${d.title ? `<h3 style="font-size: 18px; font-weight: 900; color: #1c1917; margin: 0 0 14px; text-align: center;">${escHtml(d.title)}</h3>` : ''}
  <div style="space-y: 8px;">
    ${items.map(it => `
    <details style="background: white; border: 1px solid #e5e7eb; border-radius: 14px; margin-bottom: 8px; overflow: hidden;">
      <summary style="padding: 14px 16px; font-size: 13px; font-weight: 700; color: #1c1917; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center;">
        ${escHtml(it.q)} <span style="font-size: 16px; color: #16a34a; flex-shrink:0; margin-left:8px;">＋</span>
      </summary>
      <p style="padding: 0 16px 14px; font-size: 13px; color: #57534e; line-height: 1.7; margin: 0;">${escHtml(it.a)}</p>
    </details>`).join('')}
  </div>
</div>`.trim()
}

function sectionStats(d: Record<string, string>): string {
  const items = [1,2,3,4]
    .map(i => ({ num: d[`stat${i}_num`], label: d[`stat${i}_label`] }))
    .filter(x => x.num && x.label)
  if (!items.length) return ''
  const cols = items.length <= 2 ? items.length : items.length === 3 ? 3 : 2
  return `
<div style="padding: 16px 0 8px;">
  ${d.title ? `<h3 style="font-size: 18px; font-weight: 900; color: #1c1917; text-align: center; margin: 0 0 16px;">${escHtml(d.title)}</h3>` : ''}
  <div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 10px; text-align: center;">
    ${items.map(it => `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 16px 8px;">
      <p style="font-size: 28px; font-weight: 900; color: #16a34a; margin: 0 0 4px; line-height: 1;">${escHtml(it.num)}</p>
      <p style="font-size: 11px; font-weight: 700; color: #15803d; margin: 0;">${escHtml(it.label)}</p>
    </div>`).join('')}
  </div>
</div>`.trim()
}

function sectionCountdown(d: Record<string, string>): string {
  if (!d.end_datetime) return ''
  return `{{countdown:${d.end_datetime}|${d.title || 'Tawaran tamat dalam:'}|${d.expired_text || 'Tawaran telah tamat'}}}`
}

export function sectionsToHtml(sections: Section[]): string {
  return sections.map(s => {
    switch (s.type) {
      case 'hero':        return sectionHero(s.data)
      case 'text':        return sectionText(s.data)
      case 'benefits':    return sectionBenefits(s.data)
      case 'product':     return sectionProduct(s.data)
      case 'testimonial': return sectionTestimonial(s.data)
      case 'urgency':     return sectionUrgency(s.data)
      case 'lead-form':   return sectionLeadForm(s.data)
      case 'image':       return sectionImage(s.data)
      case 'cta-button':  return sectionCtaButton(s.data)
      case 'faq':         return sectionFaq(s.data)
      case 'stats':       return sectionStats(s.data)
      case 'countdown':   return sectionCountdown(s.data)
      default:            return ''
    }
  }).filter(Boolean).join('\n\n')
}
