# COD ikut landing page — panduan admin

Cara buka atau tutup "Bayar Semasa Terima" (COD) untuk **satu** landing page,
tanpa membukanya di seluruh kedai.

Prasyarat: `supabase/132_lp_payment_methods.sql` sudah dijalankan (sudah, 11 Sep 2026).

## Kenapa bukan toggle biasa

Halaman **Admin > Payments** mengawal `payment_methods.is_active`, dan ia
**sejagat**. Hidupkan COD di situ, ia terbuka pada setiap landing page dan di
storefront sekali. Itu bukan yang dikehendaki bila hanya satu LP perlu COD.

Sebelum migration 132 ada lubang yang lebih serius: pelayan **tidak pernah**
menyemak `is_active`. Borang menyembunyikan pilihan yang dimatikan, tetapi
permintaan yang dihantar terus ke `/api/lp/<slug>/order` dengan
`payment_method: "cod"` tetap diterima. Sekarang pelayan mengesahkan pilihan
pembeli terhadap senarai LP itu sendiri, jadi suis admin benar-benar berkesan.

## Tiga keadaan setiap LP

| Keadaan | Maksud |
|---|---|
| Tiada senarai khas | Ikut **Admin > Payments** (sekarang: FPX, Kad, DuitNow). Ini keadaan asal semua LP. |
| Senarai khas tanpa COD | Contoh: LP itu terima FPX sahaja. Senarai khas mengatasi tetapan sejagat sepenuhnya. |
| Senarai khas dengan COD | COD muncul pada LP itu sahaja. |

## Buka COD untuk satu LP

1. **Admin > Landing Pages**, tekan ikon pensel pada LP berkenaan.
2. Cari seksyen **Kaedah bayaran**.
3. Tukar dari **Ikut tetapan global** kepada **Tetapkan khas untuk LP ini**.
4. Tandakan kaedah yang dikehendaki. Contoh biasa: FPX Online Banking,
   Kad Kredit/Debit, dan **Bayar Semasa Terima**.
   Kaedah yang ditanda "dimatikan secara global" tetap boleh dipilih di sini —
   itulah tujuan senarai khas.
5. **Simpan**. Dalam senarai LP, baris itu akan tunjuk lencana
   **Bayaran khas · COD**.

Senarai khas menggantikan tetapan sejagat sepenuhnya. Kalau ditanda COD sahaja,
FPX tidak akan muncul di LP itu. Tandakan semua yang dikehendaki.

## Tutup COD semula

Buang tanda pada Bayar Semasa Terima, atau pilih semula **Ikut tetapan global**
lalu simpan. Lencana akan hilang dari senarai.

## Order COD tidak terus disahkan

COD membawa risiko order palsu. Dalam 90 hari, order COD dari LP dibatalkan pada
kadar **10.0%** berbanding **3.6%** bagi order yang dibayar dahulu. Lima belas
nombor telefon mempunyai dua atau lebih order yang dibatalkan.

Jadi setiap order COD dari LP masuk sebagai **menunggu kelulusan**:

- Stok **tidak** ditolak
- Mata ganjaran **tidak** ditebus
- Kiraan penggunaan promo **tidak** naik
- E-mel pengesahan **tidak** dihantar

Pembeli nampak mesej bahawa pesanan COD sedang disemak, bukan pesanan disahkan.

### Cara luluskan

1. **Admin > Landing Pages > tab Orders**.
2. Di bahagian atas ada kotak **Menunggu kelulusan** dengan bilangannya.
3. Semak nama, nombor telefon, alamat dan jumlah. Hubungi pembeli jika perlu.
4. **Lulus** → sahkan dengan **Ya, lulus**. Stok ditolak, mata dan kiraan promo
   dikemas kini, e-mel pengesahan dihantar, status jadi `confirmed`.
5. **Tolak** → sahkan dengan **Ya, tolak**. Order dibatalkan. Tiada apa yang
   perlu dipulangkan kerana tiada apa yang pernah ditolak.

Kalau stok tidak mencukupi semasa meluluskan, order ditanda **Stok tak cukup**
dan admin perlu hubungi pembeli. Kelulusan tetap diteruskan supaya order tidak
tersangkut separuh jalan.

> **Penting:** selepas COD dibuka, order COD **tidak akan bergerak** sehingga
> seseorang meluluskannya. Semak tab Orders setiap hari, jika tidak pembeli
> tertunggu tanpa e-mel pengesahan.

## Jangan buat ini

- Jangan hidupkan COD di **Admin > Payments**. Itu membukanya di mana-mana dan
  mengembalikan masalah asal.
- Jangan tulis `landing_pages.payment_methods` terus di pangkalan data. Borang
  admin mengesahkan id terhadap katalog `payment_methods`; tulisan terus tidak.

## Rujukan kod

| Fail | Peranan |
|---|---|
| `supabase/132_lp_payment_methods.sql` | `landing_pages.payment_methods`, `lp_guest_orders.needs_approval` |
| `src/lib/lp-payment.ts` | Sumber tunggal senarai dibenarkan; dipakai borang **dan** pelayan |
| `src/app/api/lp/[slug]/order/route.ts` | Sahkan kaedah bayaran, tanda `needs_approval` untuk COD |
| `src/app/api/admin/landing-pages/orders/route.ts` | `action: approve` / `reject` |
| `src/app/admin/landing-pages/lp-client.tsx` | Pemilih kaedah bayaran, barisan menunggu kelulusan |
