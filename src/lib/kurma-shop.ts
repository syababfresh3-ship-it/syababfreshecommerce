// Kedai kurma satu page di subdomain (kurma.syababfresh.my/shop → route /kurma/shop).
// Keputusan pemilik 23 Okt 2026: subdomain jual terus produk KERING sahaja — kurma, serunding,
// buah kering, kismis, kacang — tanpa buah segar. Page utama subdomain kekal gift box (iklan
// Ramadan message-match); /shop ditambah sebagai tab. Beli guna troli & checkout kedai sedia ada
// (useCartStore → /cart → /checkout) yang dilalukan terus pada hos kurma oleh proxy.
// Fail ini client-safe (tiada DB) — konfigurasi + copy + jenis. Data: lib/kurma-shop-data.ts.
import type { Product, ProductVariant } from '@/types'

export type ShopProduct = Product & { product_variants: ProductVariant[] }
export interface ShopSection { id: string; title: string; slug: string; products: ShopProduct[] }

/** Seksyen ikut susunan papar. `slugs` = slug kategori DB (produk dalam kategori itu masuk seksyen ini). */
export const SHOP_SECTIONS: { id: string; title: string; slugs: string[] }[] = [
  { id: 'ajwa', title: 'Kurma Ajwa', slugs: ['kurma-ajwa'] },
  { id: 'safawi', title: 'Kurma Safawi', slugs: ['kurma-safawi'] },
  { id: 'medjoul', title: 'Kurma Medjoul', slugs: ['kurma-medjoul'] },
  { id: 'mariami', title: 'Kurma Mariami', slugs: ['kurma-mariami'] },
  { id: 'sukkari', title: 'Kurma Sukkari', slugs: ['kurma-sukkari'] },
  // 'kurma' (induk) — produk yang diletak terus di induk, bukan sub-kategori
  { id: 'kurma-lain', title: 'Kurma Lain-lain', slugs: ['kurma-lain-lain', 'kurma'] },
  { id: 'serunding', title: 'Serunding', slugs: ['serunding'] },
  { id: 'buah-kering', title: 'Buah Kering', slugs: ['buah-kering'] },
  { id: 'kismis', title: 'Kismis', slugs: ['kismis'] },
  { id: 'kacang', title: 'Kacang', slugs: ['kacang'] },
]
// Sengaja TIADA: 'kurma-muda-segar' (kurma muda/fresh = rantai sejuk, bukan barang kering).

/** Produk dikecualikan walau kategorinya masuk — barang sejuk beku tak sesuai kedai kering. Ubah di sini. */
export const SHOP_EXCLUDE_PRODUCT_SLUGS: string[] = ['kurma-sejuk-beku']

export const SHOP_META = {
  title: 'Beli Kurma Online — Ajwa, Safawi, Medjoul & Lagi | SyababFresh',
  description:
    'Kedai kurma online SyababFresh: Ajwa, Safawi, Medjoul, Mariami, Sukkari, serunding, buah kering, kismis & kacang. Pilih saiz, bayar online, pos ke pintu rumah.',
}

export const SHOP_WA_TEXT =
  'Salam Syabab Dates 👋\n\nSaya nak beli kurma dari kedai online (Shop). Boleh bantu?\n\nProduk: ___\nSaiz / kuantiti: ___\nHantar ke (negeri): ___'

export const rm2 = (n: number) => `RM${Number(n).toFixed(2)}`

// FAQ pembeli kurma — dipapar dalam UI /kurma/shop DAN dihantar sebagai FAQPage JSON-LD
// (faqPageSchema guna q/a sahaja; `link` hanya untuk UI). Fakta: artikel jenis-kurma-malaysia,
// GIFT_FAQ (lead time ~2 minggu, min 50 kotak), RAMADAN.deadline, borong-pricing (karton 5kg/3kg).
export interface ShopFaq { q: string; a: string; link?: { host: 'kurma' | 'shop'; path: string; label: string } }
export const SHOP_FAQ: ShopFaq[] = [
  {
    q: 'Apa beza kurma Ajwa, Safawi, Medjoul, Mariami & Sukkari?',
    a: 'Ajwa (Madinah) hitam, lembut dan manis halus — paling dicari menjelang Ramadan. Safawi (Madinah) hitam memanjang dengan sedikit nota karamel, lebih berpatutan. Medjoul paling besar dan berisi, rasa paling berkaramel. Mariami kurma harian yang lembut berkulit nipis, mesra kanak-kanak dan warga emas. Sukkari (Arab Saudi) keemasan dan paling manis, ada versi kering dan Rotab.',
    link: { host: 'shop', path: '/panduan/jenis-kurma-malaysia', label: 'Baca panduan penuh jenis kurma' },
  },
  {
    q: 'Berapa lama penghantaran kurma ke seluruh Malaysia?',
    a: 'Lembah Klang biasanya sampai dalam 24 jam selepas pesanan disahkan. Negeri lain, termasuk Sabah & Sarawak, 1–3 hari bekerja melalui kurier. Kos penghantaran dikira di checkout ikut poskod dan berat, dan anda terima nombor tracking bila bungkusan dihantar.',
  },
  {
    q: 'Macam mana nak simpan kurma supaya tahan lama?',
    a: 'Simpan dalam bekas tertutup di tempat sejuk dan gelap. Dalam cuaca Malaysia, peti sejuk lebih selamat terutama untuk kurma lembap seperti Medjoul dan Ajwa gred besar. Rotab dan kurma muda disimpan sejuk beku dan dikeluarkan sedikit demi sedikit. Kurma yang mengeras masih boleh dimakan — kukus sebentar atau simpan semalaman bersama sekeping roti dalam bekas tertutup.',
  },
  {
    q: 'Boleh beli kurma sebagai gift atau hadiah?',
    a: 'Boleh. Untuk hadiah individu, pilih kurma di page ini dan masukkan alamat penerima di checkout. Untuk gift kurma berjenama dengan logo syarikat (minimum 50 kotak, harga termasuk kurma, design percuma), lihat page Gift Box Kurma.',
    link: { host: 'kurma', path: '/', label: 'Lihat gift box kurma custom' },
  },
  {
    q: 'Bila patut order kurma untuk Ramadan?',
    a: 'Ramadan 1448H dijangka bermula sekitar 8 Februari 2027. Untuk stok runcit, order dari pertengahan Januari supaya pilihan gred dan saiz masih lengkap dan bungkusan sampai sebelum hari pertama puasa. Untuk gift box custom, tempah sebelum 1 Februari 2027 kerana proses design, cetak dan bungkus mengambil lebih kurang 2 minggu bekerja.',
  },
  {
    q: 'Ada harga borong untuk kuantiti banyak?',
    a: 'Ada. Kurma borong dijual ikut karton (5kg sekarton, Sukkari 3kg) untuk kedai, bazar, masjid dan agen. Harga borong muktamad ikut kuantiti dan stok semasa — mohon senarai harga di page Kurma Borong atau terus WhatsApp kami.',
    link: { host: 'kurma', path: '/borong', label: 'Lihat kurma borong & program agen' },
  },
]

