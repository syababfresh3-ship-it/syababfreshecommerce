// Klang Valley postcode → zone mapping
// Edit this file to adjust zones — no other code changes needed

export interface ZoneConfig {
  id: string
  name: string
  prefixes: string[]   // match postcode.startsWith(prefix)
  color: string        // used for UI badge
  emoji: string
}

export const KV_ZONES: ZoneConfig[] = [
  {
    id: 'kl',
    name: 'KL City',
    prefixes: ['50', '51', '52', '53', '54', '55', '57', '58', '59'],
    color: 'red',
    emoji: '🏙️',
  },
  {
    id: 'cheras',
    name: 'Cheras / Ampang',
    prefixes: ['56', '68'],
    color: 'orange',
    emoji: '🌆',
  },
  {
    id: 'pj',
    name: 'PJ / Damansara',
    prefixes: ['46'],
    color: 'blue',
    emoji: '🏘️',
  },
  {
    id: 'subang',
    name: 'Subang / USJ / Sunway',
    prefixes: ['47'],
    color: 'purple',
    emoji: '🌇',
  },
  {
    id: 'shaalam',
    name: 'Shah Alam / Kota Kemuning',
    prefixes: ['40'],
    color: 'green',
    emoji: '🏗️',
  },
  {
    id: 'klang',
    name: 'Klang / Setia Alam',
    prefixes: ['41', '42'],
    color: 'teal',
    emoji: '⚓',
  },
  {
    id: 'bangi',
    name: 'Kajang / Bangi / Putrajaya',
    prefixes: ['43', '62', '63'],
    color: 'yellow',
    emoji: '🎓',
  },
  {
    id: 'rawang',
    name: 'Rawang / Selayang',
    prefixes: ['48'],
    color: 'pink',
    emoji: '🌳',
  },
]

// Pulang null bila poskod tiada atau bukan Klang Valley — order sebegini LUAR
// liputan Lalamove same-day, jadi tidak dimasukkan ke dalam mana-mana zon.
export function getZone(postcode: string | null | undefined): ZoneConfig | null {
  if (!postcode) return null
  const p = postcode.trim()
  for (const zone of KV_ZONES) {
    if (zone.prefixes.some((prefix) => p.startsWith(prefix))) return zone
  }
  return null
}

// Extract 5-digit postcode from free-text address string
export function extractPostcode(address: string | null | undefined): string | null {
  if (!address) return null
  const match = address.match(/\b(\d{5})\b/)
  return match ? match[1] : null
}

export const ZONE_COLORS: Record<string, string> = {
  red:    'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  blue:   'bg-blue-100 text-blue-700 border-blue-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  green:  'bg-green-100 text-green-700 border-green-200',
  teal:   'bg-teal-100 text-teal-700 border-teal-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pink:   'bg-pink-100 text-pink-700 border-pink-200',
  gray:   'bg-gray-100 text-gray-600 border-gray-200',
}
