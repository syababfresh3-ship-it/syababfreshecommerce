// Jemputan daftar ahli dari kaunter POS: pautan wa.me pra-isi (dibuka di peranti kasyer, tiada API, tiada risiko ban).
// Pautan daftar TIDAK membawa nombor telefon dalam URL (data peribadi) — mesej suruh pelanggan guna nombor yang sama;
// mata menunggu dituntut automatik oleh trigger profiles bila telefon sepadan (migration 169).
export const SIGNUP_URL = 'https://shop.syababfresh.my/daftar'

export function memberInviteText(pendingPoints: number, name?: string | null): string {
  const hi = name ? `Salam ${name.split(' ')[0]},` : 'Salam,'
  const pts = pendingPoints > 0 ? `${pendingPoints.toLocaleString('en-MY')} mata ganjaran anda sedang menunggu. ` : ''
  return [
    `${hi} terima kasih membeli di SyababFresh.`,
    `${pts}Daftar percuma sebagai ahli untuk tuntut mata dan tebus potongan harga pada pembelian akan datang.`,
    '',
    `Daftar di ${SIGNUP_URL}`,
    'Gunakan nombor telefon yang sama dengan yang dicatat di kaunter.',
  ].join('\n')
}

export function memberInviteLink(phoneNorm: string, pendingPoints: number, name?: string | null): string {
  return `https://wa.me/${phoneNorm}?text=${encodeURIComponent(memberInviteText(pendingPoints, name))}`
}
