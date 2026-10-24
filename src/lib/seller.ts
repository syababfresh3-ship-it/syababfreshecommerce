// Butiran syarikat (penjual) & akaun bank untuk dokumen rasmi (sebut harga; invois
// sedia ada masih guna const sendiri dalam invoice-pdf.tsx — selaraskan kemudian).
// Sumber: invois sedia ada + sebut harga Refrens pemilik (24 Okt 2026).

export const SELLER = {
  brand: 'SyababFresh',
  name: 'Syabab Trading Sdn Bhd',
  regNew: '202401038338',
  regOld: '1584185-T',
  tin: 'C 59556871080',
  msic: '103014, 46316',
  activity: 'Wholesale of dates, fruits',
  addr1: 'Lot No. 2 (Semi-D), Kompleks Premis Usahawan SME Bank Bangi,',
  addr2: 'Jalan 6C/13A, Seksyen 16, Bandar Baru Bangi, Selangor, Malaysia',
  pic: 'Muhammad Anas bin Mohd Bukhari',
  email: 'syababtrading@gmail.com',
  phone: '011 5681 6548',          // umum / invois kedai
  phoneSales: '+60 11 5640 3601',  // jualan korporat & borong (dipakai pada sebut harga, sama seperti Refrens)
}

export type BankKey = 'publicbank' | 'maybank'
export const BANKS: Record<BankKey, { name: string; accName: string; accNo: string }> = {
  publicbank: { name: 'Public Bank', accName: 'Syabab Trading Sdn Bhd', accNo: '3-8248480-18' },
  maybank:    { name: 'Maybank',     accName: 'Syabab Trading Sdn Bhd', accNo: '562263630996' },
}
export const DEFAULT_BANK_KEY: BankKey = 'publicbank'
export function bankFor(key: string | null | undefined) {
  return BANKS[(key as BankKey) in BANKS ? (key as BankKey) : DEFAULT_BANK_KEY]
}
