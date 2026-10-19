// Tag {{kurma:...}} dalam html_content LP builder — blok funnel gift box yang boleh
// diletak di mana-mana dalam HTML sales (lib/lp-host.ts: biasanya LP hos 'kurma').
// Dihurai di pelayan (lp/[slug]/page.tsx); senarai ini juga dipakai chip bantuan admin.
//
//   {{kurma:menu}}            menu & WhatsApp kongsi (KurmaNav, tiada tab aktif)
//   {{kurma:kira}}            kalkulator harga gift box (GiftCalculator) — id="kira"
//   {{kurma:wa|Teks butang}}  butang WhatsApp lead (teks pra-isi GIFT_WA_TEXT)
//   {{kurma:renders}}         strip "Design yang kami hasilkan" (render berlabel)
//   {{kurma:galeri|8}}        foto produk sebenar (N pertama, lalai 8)
//   {{kurma:studio|Teks}}     butang ke Studio (reka + sebut harga)
//   {{kurma:fab}}             butang WhatsApp terapung (KurmaFab)
//   {{kurma:footer}}          footer kongsi (KurmaFooter)
export const KURMA_TAG_RE = /\{\{kurma:[a-z]+(?:\|[^}]*)?\}\}/
export const KURMA_TAG_IDS = ['menu', 'kira', 'wa', 'renders', 'galeri', 'studio', 'fab', 'footer'] as const
export type KurmaTagId = (typeof KURMA_TAG_IDS)[number]

export interface KurmaTag { id: KurmaTagId; arg: string }

/** `{{kurma:wa|Teks}}` → { id: 'wa', arg: 'Teks' }; tag tak dikenali → null (dirender kosong). */
export function parseKurmaTag(part: string): KurmaTag | null {
  const m = part.match(/^\{\{kurma:([a-z]+)(?:\|([^}]*))?\}\}$/)
  if (!m) return null
  const id = m[1] as KurmaTagId
  if (!KURMA_TAG_IDS.includes(id)) return null
  return { id, arg: (m[2] ?? '').trim() }
}

/** Chip bantuan admin — satu sumber dengan huraian di atas. */
export const KURMA_TAG_HELP: { tag: string; title: string }[] = [
  { tag: '{{kurma:menu}}',           title: 'Menu kongsi kurma (Gift Box · Korporat · Borong · Portfolio) + butang WhatsApp' },
  { tag: '{{kurma:kira}}',           title: 'Kalkulator harga gift box — pelanggan pilih kurma/berat/kuantiti, terus dapat anggaran & WhatsApp' },
  { tag: '{{kurma:wa|Teks butang}}', title: 'Butang WhatsApp lead (mesej pra-isi gift box). Teks selepas | = label butang' },
  { tag: '{{kurma:renders}}',        title: 'Strip "Design yang kami hasilkan" — render artwork klien (berlabel visual render)' },
  { tag: '{{kurma:galeri|8}}',       title: 'Foto produk sebenar (kotak siap). Nombor selepas | = bilangan foto (lalai 8)' },
  { tag: '{{kurma:studio|Teks}}',    title: 'Butang ke Studio: pelanggan letak logo, pilih template, dapat sebut harga' },
  { tag: '{{kurma:fab}}',            title: 'Butang WhatsApp terapung di bawah kanan (sorok bila kalkulator kelihatan)' },
  { tag: '{{kurma:footer}}',         title: 'Footer kongsi kurma (pautan, telefon, terma)' },
]
