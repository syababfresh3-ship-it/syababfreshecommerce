// Kandungan panduan & FAQ — SEO/AEO/GEO Fasa 3.
// Tambah artikel baru = tambah satu entry dalam ARTIKEL. Page & sitemap auto ikut.

export type Artikel = {
  slug: string
  title: string
  description: string
  updated: string // YYYY-MM
  sections: { heading: string; body: string[] }[]
  faq: { q: string; a: string }[]
}

export const ARTIKEL: Artikel[] = [
  {
    slug: 'panduan-ceri-turki',
    title: 'Panduan Ceri Turki: Cara Pilih, Simpan & Bila Musimnya',
    description:
      'Semua yang anda perlu tahu sebelum beli ceri Turki di Malaysia — musim, cara simpan supaya tahan lama, dan cara kenal ceri yang segar.',
    updated: '2026-07',
    sections: [
      {
        heading: 'Bila musim ceri Turki?',
        body: [
          'Ceri Turki bermusim sekali setahun sahaja — biasanya dari pertengahan Jun hingga Ogos. Sebab tu ceri hanya muncul di pasaran Malaysia dalam tempoh ni, dan setiap batch yang mendarat adalah stok terhad.',
          'Di luar musim Turki, ceri yang dijual biasanya dari USA (musim lewat Mei–Julai) atau dari hemisfera selatan seperti Chile dan Australia (musim Disember–Februari). Jadi kalau nampak ceri di bulan Januari, itu bukan ceri Turki.',
        ],
      },
      {
        heading: 'Cara kenal ceri yang segar',
        body: [
          'Tengok tangkainya dulu: tangkai hijau segar bermaksud ceri baru dipetik; tangkai kering kehitaman bermaksud ceri dah lama dalam simpanan. Buahnya pula kena tegang, berkilat dan keras sedikit bila ditekan — ceri yang lembik atau berkedut sudah lepas puncak kesegarannya.',
          'Warna gelap (merah tua hingga hampir hitam) biasanya bermaksud lebih manis untuk kebanyakan varieti ceri Turki seperti Ziraat 0900.',
        ],
      },
      {
        heading: 'Cara simpan ceri supaya tahan lama',
        body: [
          'Peraturan paling penting: jangan basuh ceri sebelum simpan. Air mempercepatkan proses reput. Basuh hanya bila nak makan.',
          'Simpan dalam peti sejuk (bahagian chiller, 0–4°C) dalam bekas asal atau bekas bertutup yang ada sedikit pengudaraan. Dengan cara ni ceri boleh tahan 5–10 hari. Di suhu bilik, ceri hanya tahan 1–2 hari.',
          'Nak simpan lebih lama? Buang biji, masukkan dalam beg kedap udara dan bekukan — ceri beku tahan berbulan dan sedap dibuat smoothie.',
        ],
      },
      {
        heading: 'Kenapa harga ceri berbeza-beza?',
        body: [
          'Harga ceri bergantung pada saiz buah (dikira dalam "row" — semakin kecil nombornya semakin besar buahnya), varieti, dan kos penerbangan. Ceri adalah buah yang sangat sensitif — ia diterbangkan masuk (bukan melalui laut) dan mesti kekal dalam rantaian sejuk dari ladang sampai ke pintu rumah anda.',
          'Sebab tu ceri yang dijual murah sangat perlu diteliti — kemungkinan ia stok lama atau rantaian sejuknya terputus.',
        ],
      },
    ],
    faq: [
      {
        q: 'Berapa lama ceri Turki tahan dalam peti sejuk?',
        a: 'Sekitar 5 hingga 10 hari dalam chiller (0–4°C) jika tidak dibasuh dan disimpan dalam bekas bertutup. Basuh hanya sebelum makan.',
      },
      {
        q: 'Bila musim ceri Turki di Malaysia?',
        a: 'Pertengahan Jun hingga Ogos setiap tahun. Dalam tempoh ini ceri Turki tiba secara berkala di Malaysia melalui penerbangan, dan setiap batch adalah stok terhad.',
      },
      {
        q: 'Ceri sampai rosak, macam mana?',
        a: 'SyababFresh memberi jaminan kesegaran — jika ceri sampai dalam keadaan rosak, hantar gambar bukti dalam masa 24 jam dan kami akan ganti baru atau pulangkan wang sepenuhnya.',
      },
      {
        q: 'Ceri dihantar macam mana supaya tak rosak?',
        a: 'Setiap pesanan dibungkus dalam cooler box dengan pek ais (rantaian sejuk) dan dihantar melalui penghantaran pantas — dalam 24 jam untuk Lembah Klang, 1–3 hari bekerja untuk seluruh Semenanjung Malaysia.',
      },
    ],
  },
  {
    slug: 'panduan-harumanis',
    title: 'Panduan Mangga Harumanis Perlis: Musim, Gred & Cara Peram',
    description:
      'Kenali mangga Harumanis Perlis — bila musimnya, beza gred, cara peram dengan betul, dan kenapa ia digelar raja mangga Malaysia.',
    updated: '2026-07',
    sections: [
      {
        heading: 'Apa istimewanya Harumanis?',
        body: [
          'Harumanis ialah varieti mangga premium yang hanya ditanam secara komersial di Perlis — tanah dan iklim negeri itu memberi rasa manis, lemak dan aroma harum yang tak dapat ditiru di tempat lain. Ia sering digelar "raja mangga Malaysia" dan menjadi buruan setiap kali musimnya tiba.',
          'Isi Harumanis berwarna oren keemasan, lembut tanpa serabut, dan manisnya datang dengan aroma wangi yang kuat — sebab tu namanya "harum" + "manis".',
        ],
      },
      {
        heading: 'Bila musim Harumanis?',
        body: [
          'Musim Harumanis sangat pendek — biasanya April hingga Jun sahaja setiap tahun. Di luar tempoh ni, Harumanis tulen memang tiada; jika ada yang menjualnya di bulan lain, berhati-hati dengan mangga varieti lain yang dilabel sebagai Harumanis.',
          'Sebab musimnya pendek, pesanan awal (pre-order) adalah perkara biasa — stok setiap gred terhad mengikut hasil ladang.',
        ],
      },
      {
        heading: 'Kenali gred Harumanis',
        body: [
          'Harumanis biasanya digredkan mengikut saiz dan kualiti kulit. Gred premium bersaiz besar (600g ke atas sebiji) dengan kulit mulus, manakala gred ekonomi lebih kecil atau ada sedikit tanda pada kulit — tetapi rasa isinya sama manis.',
          'Untuk hadiah atau tetamu, pilih gred premium. Untuk makan sendiri di rumah, gred ekonomi selalunya paling berbaloi.',
        ],
      },
      {
        heading: 'Cara peram Harumanis dengan betul',
        body: [
          'Harumanis dipetik matang tetapi belum masak — ia perlu diperam. Simpan di suhu bilik (bukan dalam peti sejuk!) selama 2–4 hari sehingga baunya harum dan isinya lembut bila ditekan perlahan.',
          'Petua: peram dalam kotak atau balut dengan kertas, jauhkan dari cahaya matahari terus. Jangan sesekali peram dalam peti sejuk — kesejukan menghentikan proses masak dan merosakkan rasa.',
          'Bila dah masak, barulah boleh simpan dalam peti sejuk untuk melambatkan proses — dan Harumanis sejuk memang sedap dimakan terus.',
        ],
      },
    ],
    faq: [
      {
        q: 'Bila musim Harumanis di Malaysia?',
        a: 'April hingga Jun setiap tahun. Musimnya pendek dan hasilnya terhad, jadi pre-order adalah perkara biasa.',
      },
      {
        q: 'Kenapa Harumanis hanya ada di Perlis?',
        a: 'Kombinasi tanah dan iklim panas kering Perlis menghasilkan rasa dan aroma Harumanis yang unik. Varieti sama yang ditanam di tempat lain tidak mencapai kualiti yang serupa.',
      },
      {
        q: 'Harumanis perlu diperam ke?',
        a: 'Ya. Peram di suhu bilik 2–4 hari sehingga aromanya kuat dan isi lembut bila ditekan. Jangan peram dalam peti sejuk — ia akan merosakkan proses masak.',
      },
      {
        q: 'Macam mana nak tahu Harumanis dah masak?',
        a: 'Baunya harum semerbak walaupun belum dipotong, dan isinya sedikit lembut bila ditekan perlahan di bahagian bawah buah. Kulit Harumanis kekal hijau walaupun masak — jangan tunggu ia bertukar kuning.',
      },
    ],
  },
  {
    slug: 'faq-penghantaran',
    title: 'FAQ Penghantaran Buah SyababFresh: Kawasan, Tempoh & Jaminan',
    description:
      'Soalan lazim tentang penghantaran buah segar SyababFresh — kawasan dihantar, berapa lama, cara bungkusan cold-chain, dan jaminan buah rosak.',
    updated: '2026-07',
    sections: [
      {
        heading: 'Kawasan penghantaran',
        body: [
          'SyababFresh menghantar ke seluruh Semenanjung Malaysia. Untuk Lembah Klang, penghantaran adalah dalam masa 24 jam selepas pesanan disahkan (rider/kurier hari sama). Untuk negeri-negeri lain, 1–3 hari bekerja melalui kurier rantaian sejuk.',
        ],
      },
      {
        heading: 'Macam mana buah dibungkus?',
        body: [
          'Buah sensitif seperti ceri, strawberi dan anggur dibungkus dalam cooler box bersama pek ais supaya suhu kekal rendah sepanjang perjalanan. Buah lain dibungkus dengan pelindung supaya tidak lebam. Kami pilih jenis bungkusan ikut jenis buah dan jarak penghantaran.',
        ],
      },
      {
        heading: 'Jaminan kesegaran',
        body: [
          'Setiap pesanan dilindungi jaminan kesegaran. Kalau buah sampai dalam keadaan rosak atau tidak memuaskan, hantar gambar bukti kepada kami dalam masa 24 jam selepas terima — kami akan hantar ganti atau pulangkan wang sepenuhnya, tanpa soal banyak.',
        ],
      },
    ],
    faq: [
      {
        q: 'SyababFresh hantar ke kawasan mana?',
        a: 'Seluruh Semenanjung Malaysia. Lembah Klang menerima penghantaran dalam 24 jam; negeri lain 1–3 hari bekerja melalui kurier rantaian sejuk.',
      },
      {
        q: 'Berapa kos penghantaran?',
        a: 'Kos dikira mengikut zon poskod dan berat pesanan, dan dipaparkan sebelum anda membuat bayaran di checkout. Sesetengah promosi menawarkan penghantaran percuma.',
      },
      {
        q: 'Boleh bayar COD (cash on delivery)?',
        a: 'COD tersedia untuk kawasan tertentu di Lembah Klang. Pilihan pembayaran lain: FPX online banking, kad kredit/debit dan e-dompet.',
      },
      {
        q: 'Buah sampai rosak — apa perlu saya buat?',
        a: 'Ambil gambar buah dan bungkusan, hantar kepada kami melalui halaman Bantuan atau WhatsApp dalam masa 24 jam. Kami akan ganti baru atau pulangkan wang penuh.',
      },
      {
        q: 'Boleh order hari ini, terima esok?',
        a: 'Boleh untuk Lembah Klang — pesanan yang disahkan akan sampai dalam masa 24 jam. Untuk luar Lembah Klang, jangkakan 1–3 hari bekerja.',
      },
    ],
  },
]

export function getArtikel(slug: string) {
  return ARTIKEL.find((a) => a.slug === slug)
}
