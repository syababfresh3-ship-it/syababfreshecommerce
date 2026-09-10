// Pembantu TULEN (tanpa React/DOM) untuk borang alamat & penerima di checkout:
// pengesahan medan (ralat inline), susunan medan untuk scroll-ke-ralat pertama,
// dan pembinaan rentetan alamat yang dihantar ke server.
//
// Nota bentuk request: /api/orders (member) dan /api/store/guest-order (tetamu)
// hanya terima SATU rentetan alamat + poskod berasingan. Bandar & negeri (autofill
// dari /api/delivery/check) dilampirkan ke rentetan itu — bentuk request TIDAK
// berubah, sama seperti buildAddressString untuk alamat tersimpan.
import { isValidMyMobile } from './phone'

export const MALAYSIA_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
  'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur',
  'W.P. Labuan', 'W.P. Putrajaya',
] as const

export type CheckoutField =
  | 'recipient_name'
  | 'phone'
  | 'email'
  | 'pickup_date'
  | 'full_address'
  | 'postcode'

// Susunan visual borang — ralat pertama ikut susunan ini di-scroll & difokus.
export const CHECKOUT_FIELD_ORDER: CheckoutField[] = [
  'recipient_name', 'phone', 'email', 'pickup_date', 'full_address', 'postcode',
]

export type CheckoutErrors = Partial<Record<CheckoutField, string>>

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const POSTCODE_RE = /^\d{5}$/

export function validateCheckoutForm(input: {
  recipient_name: string
  phone: string
  email: string
  isPickup: boolean
  pickup_date: string
  // Alamat berkesan (tersimpan → rentetan terbina; manual → jalan sahaja)
  full_address: string
  postcode: string
  // Item yang hanya boleh dihantar dalam Klang Valley (poskod luar KV)
  localOnlyItems?: string[]
}): CheckoutErrors {
  const e: CheckoutErrors = {}

  if (input.recipient_name.trim().length < 2) e.recipient_name = 'Sila masukkan nama penerima'

  if (!input.phone.trim()) e.phone = 'Sila masukkan nombor WhatsApp'
  else if (!isValidMyMobile(input.phone)) e.phone = 'Format nombor tidak sah — cth: 0123456789 atau +60123456789'

  // Email wajib untuk SEMUA (tracking pesanan dihantar via email — WA sering ban)
  if (!EMAIL_RE.test(input.email.trim())) e.email = 'Sila masukkan email yang sah untuk tracking pesanan'

  if (input.isPickup) {
    if (!input.pickup_date) e.pickup_date = 'Sila pilih tarikh untuk ambil sendiri'
    return e
  }

  if (!input.full_address.trim()) e.full_address = 'Sila masukkan alamat penghantaran'
  else if (input.full_address.trim().length < 10) e.full_address = 'Alamat terlalu pendek — sertakan no. rumah & nama jalan'

  // Poskod 5-digit WAJIB — tanpa poskod, kurier tak boleh dipilih & order tak boleh dihantar
  if (!POSTCODE_RE.test(input.postcode.trim())) e.postcode = 'Sila masukkan poskod 5 digit yang sah'
  else if (input.localOnlyItems && input.localOnlyItems.length > 0) {
    e.postcode = `Item berikut hanya boleh dihantar dalam Klang Valley: ${input.localOnlyItems.join(', ')}`
  }

  return e
}

export function firstErrorField(errors: CheckoutErrors): CheckoutField | null {
  for (const f of CHECKOUT_FIELD_ORDER) if (errors[f]) return f
  return null
}

// Bina rentetan alamat manual — sama bentuk dengan alamat tersimpan (checkout
// buildAddressString): "jalan\npostcode, city, state". Bahagian kosong dilangkau.
export function buildManualAddress(input: {
  street: string
  postcode?: string | null
  city?: string | null
  state?: string | null
}): string {
  const street = input.street.trim()
  // Tiada jalan = tiada alamat (poskod/bandar sahaja tak cukup untuk kurier)
  if (!street) return ''
  const tail = [input.postcode, input.city, input.state]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')
  return tail ? `${street}\n${tail}` : street
}
