import { revalidateTag } from 'next/cache'

// Bust cache homepage (getHomeDataCached — tags products/banners/categories) bila
// katalog berubah, supaya edit admin terus nampak tanpa tunggu revalidate 5 minit.
// Panggil selepas mana-mana mutasi produk / variant / banner berjaya.
export function revalidateStorefront() {
  revalidateTag('products', 'default')
  revalidateTag('banners', 'default')
  revalidateTag('categories', 'default')
}
