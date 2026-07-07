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
    slug: 'cara-simpan-ceri',
    title: 'Cara Simpan Ceri Supaya Tahan Lama (Panduan Lengkap)',
    description:
      'Ceri cepat rosak kalau salah simpan. Panduan penuh: cara simpan dalam peti sejuk sampai 10 hari, cara bekukan sampai berbulan, dan kesilapan yang buat ceri cepat lembik.',
    updated: '2026-07',
    sections: [
      {
        heading: 'Kenapa ceri cepat rosak?',
        body: [
          'Ceri ialah antara buah paling sensitif di dunia. Selepas dipetik, ia terus "bernafas" dan setiap jam pada suhu panas memendekkan hayatnya — sebab tu ceri import diterbangkan masuk dan dihantar dalam bungkusan sejuk. Tiga musuh utama ceri: haba, lembapan berlebihan, dan lebam.',
          'Berita baiknya: dengan cara simpan yang betul, ceri yang sampai segar boleh bertahan lebih seminggu. Kuncinya cuma tiga peraturan di bawah.',
        ],
      },
      {
        heading: 'Peraturan 1: Terus masuk peti sejuk, jangan tunggu',
        body: [
          'Sebaik ceri sampai, keluarkan dari kotak penghantaran dan terus masukkan ke dalam chiller (bahagian bawah peti sejuk, 0–4°C). Setiap jam ceri duduk atas meja pada suhu bilik Malaysia bersamaan kira-kira sehari hayat yang hilang.',
          'Jangan letak ceri di pintu peti sejuk — suhu di situ naik turun setiap kali pintu dibuka. Bahagian paling dalam dan paling bawah adalah yang paling stabil.',
        ],
      },
      {
        heading: 'Peraturan 2: Jangan basuh sampai nak makan',
        body: [
          'Ini kesilapan paling biasa. Air yang tertinggal di permukaan ceri mempercepatkan kulat dan reput. Simpan ceri dalam keadaan kering — basuh hanya bahagian yang nak dimakan, masa nak makan.',
          'Kekalkan tangkai pada buah. Tangkai yang tercabut meninggalkan luka kecil tempat bakteria masuk, dan ceri bertangkai kekal segar lebih lama.',
        ],
      },
      {
        heading: 'Peraturan 3: Bekas yang betul',
        body: [
          'Guna bekas yang ada sedikit pengudaraan — bekas asal penghantaran biasanya sudah sesuai, atau bekas bertutup yang dibuka sedikit penjurunya. Bekas kedap sepenuhnya memerangkap lembapan; bekas terbuka penuh pula membuat ceri kering dan berkedut.',
          'Petua tambahan: alas dasar bekas dengan sehelai tuala kertas. Ia menyerap lembapan berlebihan dan boleh ditukar kalau basah. Jangan tindih ceri tebal-tebal — dua tiga lapis maksimum, sebab lapisan bawah akan lebam.',
          'Dengan tiga peraturan ni, ceri tahan 5–10 hari dalam chiller. Di suhu bilik? 1–2 hari sahaja. Bezanya besar.',
        ],
      },
      {
        heading: 'Nak simpan berbulan? Bekukan',
        body: [
          'Kalau beli banyak masa promo (memang patut pun, jimat), lebihan boleh dibekukan: basuh ceri, keringkan betul-betul dengan tuala, buang biji kalau rajin (guna penyedut minuman tebal — tolak biji keluar dari arah tangkai), susun sekata atas dulang dan bekukan 2 jam, lepas tu pindahkan ke beg kedap udara.',
          'Ceri beku tahan 6–12 bulan dan paling sedap dibuat smoothie, topping aiskrim, atau dimakan sejuk-sejuk terus dari freezer — rasa macam sorbet mini.',
        ],
      },
      {
        heading: 'Macam mana nak tahu ceri dah tak elok?',
        body: [
          'Tanda-tanda ceri patut diketepikan: lembik berair bila disentuh, kulit berkedut teruk, ada tompok kulat putih/kelabu, atau berbau masam macam nak jadi cuka. Satu dua biji rosak dalam bekas — buang cepat, sebab reput merebak ke biji sebelah.',
          'Ceri yang kulitnya masih tegang dan berkilat tapi rasa kurang manis? Itu bukan rosak — itu memang karakter batch tu. Manis ceri ditentukan masa ia dipetik, ia tidak bertambah manis selepas petik.',
        ],
      },
    ],
    faq: [
      {
        q: 'Berapa lama ceri tahan dalam peti sejuk?',
        a: '5 hingga 10 hari dalam chiller (0–4°C) — dengan syarat tidak dibasuh, tangkai dikekalkan, dan disimpan dalam bekas yang ada sedikit pengudaraan beralas tuala kertas.',
      },
      {
        q: 'Ceri kena basuh dulu sebelum simpan ke?',
        a: 'Jangan. Air mempercepatkan kulat dan reput. Simpan kering, basuh hanya bila nak makan.',
      },
      {
        q: 'Boleh ke simpan ceri luar peti sejuk?',
        a: 'Pada suhu bilik Malaysia, ceri hanya tahan 1–2 hari. Kalau nak makan hari sama, tak apa. Selain tu, terus masuk chiller.',
      },
      {
        q: 'Ceri beku tahan berapa lama?',
        a: '6 hingga 12 bulan dalam beg kedap udara. Sesuai untuk smoothie, topping, atau dimakan terus macam sorbet.',
      },
      {
        q: 'Kenapa ceri saya cepat lembik walaupun dalam peti sejuk?',
        a: 'Kemungkinan besar sebab dibasuh sebelum simpan, bekas terlalu kedap (lembapan terperangkap), ceri bertindih terlalu tebal, atau disimpan di pintu peti sejuk yang suhunya tidak stabil.',
      },
    ],
  },
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
