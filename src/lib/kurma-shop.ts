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
