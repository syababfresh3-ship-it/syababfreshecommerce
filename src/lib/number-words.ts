// Jumlah dalam perkataan (English, huruf besar) untuk sebut harga/invois:
// ringgitInWords(95400) → 'NINETY FIVE THOUSAND FOUR HUNDRED RINGGIT ONLY'
// ringgitInWords(12.5)  → 'TWELVE RINGGIT AND FIFTY SEN ONLY'

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION']

function below1000(n: number): string {
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const r = n % 100
  if (h) parts.push(`${ONES[h]} HUNDRED`)
  if (r < 20) { if (r) parts.push(ONES[r]) }
  else {
    const t = Math.floor(r / 10), o = r % 10
    parts.push(o ? `${TENS[t]} ${ONES[o]}` : TENS[t])
  }
  return parts.join(' ')
}

/** Integer 0..999,999,999,999 → perkataan English huruf besar. */
export function numberToWordsEn(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'ZERO'
  const parts: string[] = []
  let scale = 0
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000
    if (chunk) parts.unshift(`${below1000(chunk)}${SCALES[scale] ? ' ' + SCALES[scale] : ''}`)
    n = Math.floor(n / 1000)
    scale++
  }
  return parts.join(' ')
}

export function ringgitInWords(amount: number): string {
  const total = Math.round(Math.abs(Number(amount) || 0) * 100)
  const rm = Math.floor(total / 100)
  const sen = total % 100
  let s = `${numberToWordsEn(rm)} RINGGIT`
  if (sen > 0) s += ` AND ${numberToWordsEn(sen)} SEN`
  return `${s} ONLY`
}
