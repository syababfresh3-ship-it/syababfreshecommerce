// Geocoding: tukar alamat teks Malaysia → koordinat lat/lng.
// Lalamove v3 API WAJIB koordinat untuk setiap stop — alamat teks sahaja tak cukup.
// Guna Google Geocoding API. Hasil di-cache dalam memori proses supaya alamat sama
// tak di-geocode berulang (jimat kuota + laju).

const API_KEY = process.env.GOOGLE_GEOCODING_API_KEY
const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json'

export interface GeocodeResult {
  lat: string            // Lalamove mahu string, bukan number
  lng: string
  formatted: string      // alamat dibersihkan oleh Google
}

// Cache ringkas (alamat → hasil) — hayat sepanjang proses berjalan.
const cache = new Map<string, GeocodeResult | null>()

function normalize(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

// Pulang null kalau gagal/alamat tak dijumpai — pemanggil kena handle (flag ⚠️).
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!API_KEY) throw new Error('GOOGLE_GEOCODING_API_KEY tidak diset')
  const clean = address?.trim()
  if (!clean) return null

  const key = normalize(clean)
  if (cache.has(key)) return cache.get(key)!

  // components=country:MY = PAKSA KERAS hanya hasil Malaysia (region=my cuma bias
  // lembut). Tanpa ini, alamat kabur yang bermula "Lot ..." kadang geocode ke
  // wilayah "Lot" di Perancis → pickup/dropoff tersasar → Lalamove "out of service area".
  const url = `${ENDPOINT}?address=${encodeURIComponent(clean)}&key=${API_KEY}&region=my&language=ms&components=country:MY`

  let result: GeocodeResult | null = null
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'OK' && data.results?.length > 0) {
      const top = data.results[0]
      const loc = top.geometry.location
      result = {
        lat: String(loc.lat),
        lng: String(loc.lng),
        formatted: top.formatted_address,
      }
    } else if (data.status !== 'ZERO_RESULTS') {
      // OVER_QUERY_LIMIT / REQUEST_DENIED dll — log untuk siasat, jangan senyap
      console.error('[geocode] gagal:', data.status, data.error_message ?? '')
    }
  } catch (err) {
    console.error('[geocode] ralat rangkaian:', err)
  }

  cache.set(key, result)
  return result
}
