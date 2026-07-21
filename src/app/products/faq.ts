// Soalan lazim katalog — SATU sumber untuk dua tempat: paparan di page
// (SfCatalog) dan schema FAQPage (products/page.tsx). Kalau dipisahkan, teks
// yang dipapar dan teks yang dihantar ke Google akan lari sesama sendiri.
//
// PENTING: Google hanya layak beri rich result FAQ kalau soalan & jawapan
// BENAR-BENAR kelihatan pada page. Jangan hantar ke schema apa yang tidak
// dipapar.
//
// Sengaja berbeza daripada FAQ artikel /panduan/faq-penghantaran — soalan di
// sini fokus pada keputusan membeli semasa melihat katalog, bukan penghantaran
// secara mendalam.
export const KATALOG_FAQ: { q: string; a: string }[] = [
  {
    q: 'Berapa lama buah sampai?',
    a: 'Untuk Lembah Klang, dalam masa 24 jam selepas pesanan disahkan. Untuk negeri lain di Semenanjung Malaysia, 1 hingga 3 hari bekerja melalui kurier rantaian sejuk.',
  },
  {
    q: 'Kawasan mana yang dihantar?',
    a: 'Seluruh Semenanjung Malaysia. Lembah Klang mendapat penghantaran paling pantas; negeri lain dihantar melalui kurier yang mengekalkan suhu sejuk sepanjang perjalanan.',
  },
  {
    q: 'Berapa kos penghantaran?',
    a: 'Kos dikira mengikut zon poskod dan berat pesanan, dan dipaparkan sepenuhnya sebelum anda membayar di checkout. Sesetengah promosi menawarkan penghantaran percuma.',
  },
  {
    q: 'Macam mana buah dibungkus supaya tak rosak?',
    a: 'Buah sensitif seperti ceri, strawberi dan anggur dibungkus dalam cooler box bersama pek ais supaya suhu kekal rendah. Buah lain dibungkus dengan pelindung supaya tidak lebam. Jenis bungkusan dipilih ikut jenis buah dan jarak penghantaran.',
  },
  {
    q: 'Kalau buah sampai rosak macam mana?',
    a: 'Ambil gambar buah dan bungkusan, hantar kepada kami melalui halaman Bantuan atau WhatsApp dalam masa 24 jam selepas terima. Kami akan hantar ganti atau pulangkan wang sepenuhnya.',
  },
  {
    q: 'Buah yang saya nak habis stok — boleh tempah?',
    a: 'Pada produk yang habis stok, tekan butang "Bagitahu bila ada". Kami akan maklumkan anda sebaik kiriman baharu masuk. Banyak buah di sini bermusim, jadi stok berubah mengikut kiriman.',
  },
]
