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

// Pengesah telefon BIMBIT Malaysia untuk borang client (checkout) — lebih ketat
// daripada isValidPhone: terima 01x-xxxxxxx / +601x / 601x, iaitu 9–11 digit
// selepas "60" dan digit pertama selepas "60" mesti "1" (mobile; talian tetap
// 03- bukan nombor WhatsApp). Selamat diimport oleh client (tiada import server).
export function isValidMyMobile(phone: string | null | undefined): boolean {
  const p = normalizePhone(phone)
  if (!p.startsWith('601')) return false
  const rest = p.slice(2)
  return rest.length >= 9 && rest.length <= 11
}
