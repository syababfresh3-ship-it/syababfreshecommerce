// Normalisasi nombor telefon Malaysia ke bentuk kanonik: 60xxxxxxxxx
// (tiada +, ruang, atau tanda). Ini IDENTITI tunggal untuk master customer —
// guna di mana-mana sahaja kita padan/dedup orang supaya tiada duplikat.
// Logik ini sebelum ni diduplikasi di admin/customers, lib/murpati, tiktok page.
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return ''
  let p = String(phone).replace(/\D/g, '')
  if (!p) return ''
  if (p.startsWith('0')) p = '6' + p
  if (!p.startsWith('60')) p = '60' + p
  return p
}

// Sah kalau nampak macam nombor MY munasabah selepas normalisasi (10–13 digit).
export function isValidPhone(phone: string | null | undefined): boolean {
  const p = normalizePhone(phone)
  return p.length >= 10 && p.length <= 13
}
