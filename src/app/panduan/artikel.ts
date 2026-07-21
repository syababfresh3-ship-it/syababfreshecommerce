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
          'Ceri yang kulitnya masih tegang dan berkilat tapi rasa kurang manis? Itu bukan rosak — itu memang karakter batch tu. Manis ceri ditentukan masa ia dipetik, ia tidak bertambah manis selepas petik. [Lihat ceri yang ada sekarang](/kategori/ceri).',
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
  {
    slug: 'jenis-kurma-malaysia',
    title: 'Jenis Kurma di Malaysia: Beza Ajwa, Safawi, Medjoul, Mariami & Sukkari',
    description:
      'Keliru nak pilih kurma mana? Panduan bandingkan lima jenis kurma paling popular di Malaysia — rasa, tekstur, harga dan yang mana sesuai untuk makan harian, hidangan tetamu atau hadiah.',
    updated: '2026-07',
    sections: [
      {
        heading: 'Kenapa kurma ada banyak jenis?',
        body: [
          'Kurma bukan satu buah dengan satu rasa. Sama seperti mangga ada Harumanis, Chokanan dan Kimling, kurma pun ada ratusan kultivar — dan setiap satu berbeza dari segi saiz, kelembapan, tahap manis dan tekstur. Yang sampai ke Malaysia biasanya datang dari Arab Saudi, Palestin, Tunisia, Mesir dan Libya.',
          'Perbezaan paling ketara antara satu jenis dengan yang lain ialah dua perkara: berapa lembap isinya, dan berapa pekat manisnya. Faham dua paksi ni sahaja, anda sudah boleh pilih dengan yakin.',
        ],
      },
      {
        heading: 'Ajwa — hitam, lembut, manis halus',
        body: [
          'Ajwa datang dari Madinah, dan inilah kurma yang paling dicari di Malaysia terutama menjelang Ramadan. Warnanya hitam kelam dengan permukaan berkedut halus, teksturnya lembut, dan yang membezakannya: manisnya paling halus antara semua jenis dalam senarai ini. Ia tidak menyengat tekak walaupun dimakan beberapa biji berturut-turut.',
          'Sebab manisnya sederhana, Ajwa sesuai untuk orang yang rasa kurma lain terlalu manis. Ia juga digredkan mengikut saiz biji — Medium, Large, Jumbo dan Super Jumbo — jadi harga banyak bergantung pada saiz, bukan rasa.',
          'Pilih Ajwa kalau: anda mahu kurma untuk dimakan setiap hari tanpa rasa memberat, atau untuk dihadiahkan kepada orang yang memang mencari kurma Madinah. [Lihat semua kurma Ajwa](/kategori/kurma-ajwa).',
        ],
      },
      {
        heading: 'Safawi — hitam memanjang, sedikit rasa karamel',
        body: [
          'Juga dari Madinah, tetapi bentuknya lebih panjang dan kulitnya lebih berkilat berbanding Ajwa. Isinya lembut dengan manis sederhana, dan ada sedikit nota karamel yang tidak ada pada Ajwa.',
          'Safawi sering jadi pilihan orang yang suka profil Ajwa tetapi mahukan sesuatu yang sedikit lebih manis dan lebih berpatutan. Ia juga digredkan Medium, Large dan Jumbo.',
          'Pilih Safawi kalau: anda mahu kurma harian yang mudah diterima semua orang di rumah, termasuk kanak-kanak. [Lihat pilihan Safawi](/kategori/kurma-safawi).',
        ],
      },
      {
        heading: 'Medjoul — paling besar, paling berkaramel',
        body: [
          'Digelar raja kurma, dan sebaik anda pegang sebiji anda akan faham kenapa. Medjoul jauh lebih besar daripada kurma biasa, isinya sangat tebal dan lembap, dan rasanya paling hampir kepada karamel atau gula perang antara semua jenis.',
          'Kerana saiznya, satu biji Medjoul sudah cukup mengenyangkan sebagai snek. Ia juga kurma yang paling sesuai dibelah dan diisi dengan badam, keju atau mentega kacang — sesuatu yang sukar dibuat dengan kurma yang lebih kecil.',
          'Medjoul yang sampai ke Malaysia banyak datang dari Palestin. Ia digredkan Large, Jumbo dan Super Jumbo, dan harganya naik ketara mengikut saiz.',
          'Pilih Medjoul kalau: anda mahu kurma yang terasa mewah, untuk dihidang kepada tetamu penting atau dijadikan hadiah tanpa perlu apa-apa hiasan tambahan. [Lihat pilihan Medjoul](/kategori/kurma-medjoul).',
        ],
      },
      {
        heading: 'Mariami — lembut, kulit nipis, mesra semua orang',
        body: [
          'Mariami ialah kurma harian yang paling ramai kenal di Malaysia. Isinya lembut, kulitnya nipis, dan manisnya mesra tanpa terlalu pekat. Ia digredkan A, AA dan AAA mengikut saiz, dengan AAA yang paling besar dan paling seragam.',
          'Kerana teksturnya lembut dan tidak melekit, Mariami senang dimakan kanak-kanak dan warga emas, dan senang juga dicincang masuk ke dalam smoothie, bubur atau kuih.',
          'Pilih Mariami kalau: anda mahu stok kurma tetap di rumah yang semua orang boleh makan, pada harga yang tidak membebankan. [Lihat pilihan Mariami](/kategori/kurma-mariami).',
        ],
      },
      {
        heading: 'Sukkari — paling manis, keemasan',
        body: [
          'Nama Sukkari berasal daripada perkataan gula dalam bahasa Arab, dan itu memang menggambarkan rasanya. Datang dari Arab Saudi, warnanya kuning keemasan — bukan hitam seperti Ajwa dan Safawi — dan manisnya paling jelas antara semua jenis di sini.',
          'Sukkari ada dalam dua bentuk. Versi kering lebih pejal, sedikit rangup pada gigitan pertama, dan senang dibawa ke mana-mana. Versi Rotab pula ialah kurma pada peringkat separuh masak yang masih lembap dan gebu — biasanya disimpan sejuk beku dan dimakan sejuk seperti pencuci mulut.',
          'Pilih Sukkari kalau: anda memang suka manis, atau mahu mencuba kurma dalam bentuk yang berbeza daripada kurma kering biasa. [Lihat pilihan Sukkari](/kategori/kurma-sukkari).',
        ],
      },
      {
        heading: 'Jenis lain yang patut anda tahu',
        body: [
          'Deglet Noor dari Tunisia — coklat keemasan, langsing, isinya lebih pejal dan manisnya bersih. Sesuai kalau anda tidak gemar tekstur yang terlalu lembut. Ia juga dijual dalam bentuk masih melekat pada tangkai, yang cantik untuk hidangan meja dan hadiah.',
          'Mabroom dari Madinah — panjang, langsing dan berkedut rapat. Teksturnya paling kenyal antara semua, memberi pengalaman mengunyah yang lebih lama. Kegemaran mereka yang bosan dengan kurma terlalu lembik. [Lihat kurma lain-lain](/kategori/kurma-lain-lain).',
          'Kurma muda dan segar seperti dari Libya — dipetik sebelum kering sepenuhnya, jadi teksturnya masih berair atau separuh kering bergantung gred. Ini pilihan bermusim yang hanya ada bila kiriman masuk. [Lihat kurma muda & segar](/kategori/kurma-muda-segar).',
        ],
      },
      {
        heading: 'Ringkasnya: mana satu untuk anda?',
        body: [
          'Untuk makan setiap hari tanpa rasa memberat — Ajwa atau Mariami.',
          'Untuk hidangan tetamu yang nampak menarik di dulang — Safawi Jumbo atau Medjoul.',
          'Untuk hadiah dan bingkisan — Medjoul Super Jumbo, Ajwa gred besar, atau mana-mana pilihan kotak siap bungkus.',
          'Untuk yang memang suka manis — Sukkari.',
          'Untuk yang tak suka kurma lembik — Deglet Noor Tunisia atau Mabroom.',
          'Kalau anda betul-betul tidak pasti, mula dengan pek 100g beberapa jenis berbeza. Lebih murah daripada membeli sekilo kurma yang akhirnya tidak menepati selera anda. [Lihat semua kurma](/kategori/kurma).',
        ],
      },
      {
        heading: 'Cara simpan kurma supaya tidak mengeras',
        body: [
          'Musuh utama kurma ialah udara. Kurma yang dibiarkan dalam bungkusan terbuka akan hilang lembapan dan mengeras dalam masa beberapa hari. Pindahkan ke bekas kedap udara sebaik dibuka.',
          'Simpan di tempat sejuk dan gelap. Dalam cuaca Malaysia yang panas, peti sejuk adalah pilihan yang lebih selamat terutama untuk kurma lembap seperti Medjoul dan Ajwa gred besar.',
          'Untuk Rotab dan kurma muda yang masih lembap, simpanan sejuk beku adalah cara yang betul — keluarkan sedikit demi sedikit mengikut keperluan, dan elak mencairkan berulang kali.',
          'Kalau kurma anda sudah mengeras, ia masih boleh dimakan. Kukus sebentar atau simpan dalam bekas tertutup bersama sekeping roti selama sehari — kurma akan menyerap semula sedikit lembapan.',
        ],
      },
    ],
    faq: [
      {
        q: 'Kurma mana paling sesuai untuk makan setiap hari?',
        a: 'Ajwa dan Mariami. Kedua-duanya manis sederhana, jadi tidak memberat walaupun dimakan beberapa biji setiap hari. Mariami lebih berpatutan; Ajwa lebih halus rasanya.',
      },
      {
        q: 'Apa beza Ajwa dan Safawi?',
        a: 'Kedua-duanya kurma hitam dari Madinah. Ajwa lebih bulat dengan manis yang paling halus; Safawi lebih panjang, kulitnya lebih berkilat, dan ada sedikit nota karamel dengan manis yang sedikit lebih jelas.',
      },
      {
        q: 'Kenapa Medjoul lebih mahal?',
        a: 'Saiznya jauh lebih besar dan isinya lebih tebal, jadi bilangan biji sekilogram lebih sedikit. Gred Super Jumbo disaring pada saiz maksimum, dan itu menaikkan lagi harganya.',
      },
      {
        q: 'Apa maksud Rotab?',
        a: 'Rotab ialah kurma pada peringkat separuh masak — belum kering sepenuhnya, jadi isinya masih lembap dan gebu. Ia biasanya disimpan sejuk beku dan dimakan sejuk, teksturnya lebih hampir kepada pencuci mulut berbanding kurma kering.',
      },
      {
        q: 'Gred A, AA, AAA pada Mariami tu apa maksudnya?',
        a: 'Ia gred saiz. AAA paling besar dan paling seragam bentuknya, diikuti AA, kemudian A. Rasa asasnya sama — yang berubah ialah saiz biji dan penampilan.',
      },
      {
        q: 'Kurma saya dah keras. Boleh selamatkan tak?',
        a: 'Boleh. Kukus sebentar, atau simpan dalam bekas tertutup bersama sekeping roti selama sehari supaya kurma menyerap semula sedikit lembapan. Ia masih selamat dimakan.',
      },
      {
        q: 'Kurma kena simpan dalam peti sejuk ke?',
        a: 'Untuk cuaca Malaysia, ya — terutama kurma lembap seperti Medjoul dan Ajwa gred besar. Yang paling penting ialah bekas kedap udara; udara terbuka yang membuat kurma mengeras.',
      },
    ],
  },
  {
    slug: 'panduan-kurma-ajwa',
    title: 'Panduan Kurma Ajwa: Beza Gred Medium, Large, Jumbo & Cara Simpan',
    description:
      'Semua yang perlu anda tahu tentang kurma Ajwa Madinah — apa beza gred Medium, Large, Jumbo dan Super Jumbo, gred mana untuk tujuan apa, ciri Ajwa yang biasa, dan cara simpan supaya kekal lembut.',
    updated: '2026-07',
    sections: [
      {
        heading: 'Apa itu kurma Ajwa?',
        body: [
          'Ajwa ialah kultivar kurma yang ditanam di sekitar Madinah, Arab Saudi. Ia mudah dikenali daripada rupanya: warna hitam kelam hampir seragam, permukaan berkedut halus, dan bentuk yang lebih bulat serta padat berbanding kurma panjang seperti Safawi atau Mabroom.',
          'Yang paling membezakan Ajwa bukan rupanya, tetapi rasanya. Antara semua kurma popular, Ajwa mempunyai manis yang paling halus — tidak menyengat tekak, tiada rasa karamel pekat seperti Medjoul. Sebab itulah ramai yang boleh makan beberapa biji berturut-turut tanpa rasa muak.',
          'Di Malaysia, Ajwa adalah antara kurma paling dicari, terutamanya menjelang Ramadan dan musim perayaan. Ia juga kurma yang paling kerap dipilih sebagai hadiah dan buah tangan. [Lihat semua gred Ajwa](/kategori/kurma-ajwa).',
        ],
      },
      {
        heading: 'Gred Ajwa: apa sebenarnya yang berbeza?',
        body: [
          'Ini soalan paling kerap ditanya, dan jawapannya lebih mudah daripada yang disangka: gred Ajwa ialah gred SAIZ, bukan gred rasa. Ajwa Medium dan Ajwa Super Jumbo datang dari kultivar yang sama dengan profil rasa yang sama. Yang berbeza ialah saiz biji dan keseragaman bentuk.',
          'Medium ialah saiz asas — muat sekali suap dan paling menjimatkan. Large lebih berisi dan padat. Jumbo ketara lebih besar dengan isi yang lebih tebal. Super Jumbo VIP pula disaring pada saiz paling besar dan bentuk paling seragam, jadi ia yang paling menonjol bila disusun dalam bekas atau dulang.',
          'Kerana rasa asasnya sama, memilih gred sebenarnya soal tujuan dan bajet — bukan soal mana lebih sedap.',
        ],
      },
      {
        heading: 'Gred mana untuk tujuan apa',
        body: [
          'Untuk makan harian dan bekalan berterusan — Medium. Ia memberi rasa Ajwa yang sama pada harga paling rendah, jadi anda boleh simpan stok tanpa fikir panjang.',
          'Untuk hidangan tetamu yang singgah — Large. Saiznya sudah cukup cantik untuk dihidang, tetapi masih berpatutan untuk dibeli kerap.',
          'Untuk majlis, jamuan dan dulang buka puasa — Jumbo. Saiz besar menyerlah bila disusun dalam bekas kaca atau dulang.',
          'Untuk hadiah dan bingkisan — Super Jumbo VIP atau pilihan kotak siap bungkus. Kalau anda mahu sesuatu yang nampak berkelas tanpa perlu bungkusan tambahan, di sinilah tempatnya.',
          'Ada juga pilihan Aliyah Mix — saiz bercampur dalam satu pek. Kerana tidak disaring ketat pada satu saiz, harganya lebih berpatutan. Sesuai bila anda mementingkan rasa dan kuantiti berbanding keseragaman rupa, seperti untuk agihan atau bekalan surau.',
        ],
      },
      {
        heading: 'Ciri Ajwa yang biasa dilihat',
        body: [
          'Ajwa lazimnya berwarna hitam kelam yang agak seragam, dengan kedutan halus yang rapat di permukaan. Isinya lembut tetapi tidak berair, dan bila dibelah, warnanya coklat gelap.',
          'Ajwa juga tidak sepatutnya berkilat berminyak secara berlebihan. Permukaannya lebih kering dan matt berbanding kurma lembap seperti Medjoul.',
          'Perlu diingat: ciri-ciri ini berbeza sedikit mengikut musim, gred dan cara penyimpanan. Kurma dari batch yang sama pun boleh berbeza rupa. Cara paling selamat ialah membeli dari penjual yang anda percaya dan boleh dihubungi kalau ada masalah — bukan bergantung sepenuhnya pada pemeriksaan mata.',
        ],
      },
      {
        heading: 'Cara simpan supaya kekal lembut',
        body: [
          'Musuh utama Ajwa ialah udara. Kurma yang dibiarkan dalam bungkusan terbuka akan hilang lembapan dan mengeras dalam beberapa hari. Sebaik pek dibuka, pindahkan ke bekas kedap udara.',
          'Simpan di tempat sejuk dan gelap, jauh daripada cahaya matahari terus. Dalam cuaca panas Malaysia, peti sejuk adalah pilihan yang lebih selamat — terutama untuk gred besar yang isinya lebih tebal dan lembap.',
          'Kalau disimpan dalam peti sejuk, keluarkan sebentar sebelum dihidang. Ajwa yang dimakan terus dari peti terasa lebih keras daripada sepatutnya; beberapa minit di suhu bilik sudah memulihkan teksturnya.',
          'Ajwa yang sudah mengeras masih selamat dimakan. Kukus sebentar, atau simpan dalam bekas tertutup bersama sekeping roti selama sehari — kurma akan menyerap semula sedikit lembapan.',
        ],
      },
      {
        heading: 'Saiz pek mana yang berbaloi?',
        body: [
          'Pek 100g sesuai kalau anda belum pernah mencuba Ajwa, atau mahu membandingkan gred sebelum membeli banyak. Ia juga saiz yang senang dijadikan buah tangan ringkas.',
          'Pek 300g dan 500g adalah saiz kegunaan rumah — cukup untuk seminggu dua bagi kebanyakan keluarga tanpa risiko kurma terlalu lama terdedah.',
          'Pek 1kg ke atas hingga karton lebih berbaloi dari segi harga seunit, tetapi hanya kalau anda memang menghabiskannya — untuk keluarga besar, agihan surau dan masjid, majlis, atau jualan semula. Kalau tidak, kurma yang tersimpan terlalu lama akan mengeras walaupun disimpan dengan betul. Belum pasti Ajwa pilihan anda? [Banding dengan jenis kurma lain](/kategori/kurma).',
        ],
      },
      {
        heading: 'Bila masa terbaik untuk beli?',
        body: [
          'Permintaan kurma melonjak menjelang Ramadan, dan itu memberi kesan kepada dua perkara: harga dan ketersediaan gred besar. Gred Jumbo dan Super Jumbo biasanya yang paling cepat habis.',
          'Kalau anda merancang untuk majlis atau hadiah semasa Ramadan atau Aidilfitri, membeli awal memberi anda pilihan gred yang lebih luas. Membeli di luar musim pula selalunya lebih tenang dan stok lebih stabil.',
        ],
      },
    ],
    faq: [
      {
        q: 'Apa beza Ajwa Medium, Large, Jumbo dan Super Jumbo?',
        a: 'Semuanya kurma Ajwa yang sama dengan rasa yang sama — yang berbeza hanya saiz biji dan keseragaman bentuk. Medium paling kecil dan paling menjimatkan; Super Jumbo VIP disaring pada saiz paling besar dan paling seragam.',
      },
      {
        q: 'Ajwa gred besar lebih sedap ke?',
        a: 'Tidak semestinya. Gred ialah ukuran saiz, bukan rasa. Gred besar dipilih kerana penampilannya lebih menyerlah untuk hidangan dan hadiah, bukan kerana rasanya berbeza.',
      },
      {
        q: 'Ajwa Aliyah Mix tu apa?',
        a: 'Ia pek Ajwa Aliyah dengan saiz bercampur — ada yang sederhana, ada yang lebih besar. Kerana tidak disaring pada satu saiz tetap, harganya lebih berpatutan. Sesuai bila rasa dan kuantiti lebih penting daripada keseragaman rupa.',
      },
      {
        q: 'Kenapa Ajwa saya mengeras?',
        a: 'Hampir selalu kerana terdedah kepada udara. Pindahkan ke bekas kedap udara sebaik pek dibuka. Kalau sudah mengeras, kukus sebentar atau simpan sehari bersama sekeping roti dalam bekas tertutup.',
      },
      {
        q: 'Ajwa kena simpan dalam peti sejuk ke?',
        a: 'Dalam cuaca Malaysia, peti sejuk lebih selamat — terutama untuk gred besar. Yang paling penting tetap bekas kedap udara. Keluarkan sebentar sebelum makan supaya teksturnya kembali lembut.',
      },
      {
        q: 'Berapa pek patut saya beli?',
        a: 'Mulakan dengan 100g kalau belum pernah mencuba. Untuk kegunaan rumah, 300g hingga 500g paling praktikal. Pek 1kg ke atas berbaloi hanya kalau anda memang menghabiskannya — kurma yang terlalu lama tersimpan akan mengeras.',
      },
    ],
  },
  {
    slug: 'panduan-anggur-import',
    title: 'Panduan Anggur Import: Shine Muscat, Sweet Sapphire & Cara Simpan',
    description:
      'Beza lima jenis anggur import tanpa biji yang paling popular — Shine Muscat, Sweet Sapphire, Autumn Royal, Sweet Globe dan Crimson. Termasuk kenapa Shine Muscat mahal, cara kenal anggur segar dan cara simpan supaya kekal rangup.',
    updated: '2026-07',
    sections: [
      {
        heading: 'Kenapa anggur import semua tanpa biji?',
        body: [
          'Hampir semua anggur meja yang dijual hari ini adalah kultivar tanpa biji — bukan kerana diproses, tetapi kerana memang dibiakkan begitu. Pembeli lebih suka anggur yang boleh terus dimakan tanpa perlu meludah biji, jadi ladang komersial menumpukan kultivar tanpa biji.',
          'Kulit anggur import juga nipis dan boleh dimakan. Tidak perlu dikupas — cuma bilas sebelum makan.',
        ],
      },
      {
        heading: 'Shine Muscat — hijau, wangi, paling manis',
        body: [
          'Shine Muscat ialah kultivar yang dibangunkan di Jepun dan kini turut ditanam di beberapa negara lain, jadi asalnya berbeza mengikut kiriman. Cirinya konsisten: butir hijau kekuningan yang besar, kulit nipis, dan aroma muscat yang wangi — bau bunga yang manis, sangat berbeza daripada anggur biasa.',
          'Manisnya antara yang paling tinggi dalam dunia anggur meja, tetapi bukan manis yang memualkan; ia diimbangi oleh keharuman itu. Teksturnya rangup dan padat, bukan lembik.',
          'Kenapa mahal? Tiga sebab: hasil per pokok lebih rendah berbanding kultivar biasa, ia memerlukan penjagaan lebih rapi di ladang, dan permintaannya tinggi. Harga juga berbeza ketara mengikut gred dan asal kiriman. [Lihat anggur yang ada](/kategori/anggur).',
        ],
      },
      {
        heading: 'Sweet Sapphire — ungu, berbentuk jari',
        body: [
          'Paling mudah dikenali antara semua: bentuknya memanjang seperti jari, bukan bulat. Warnanya ungu gelap hampir kehitaman dengan kulit nipis dan tekstur yang rangup.',
          'Rasanya manis pekat tanpa masam yang ketara. Kerana bentuknya yang unik dan senang dipegang, ia pilihan popular untuk platter buah, bekal sekolah dan hidangan majlis yang mahu nampak berbeza.',
        ],
      },
      {
        heading: 'Autumn Royal, Sweet Globe & Crimson',
        body: [
          'Autumn Royal — hitam keunguan, bujur dan besar, dengan manis sekata sehingga hujung tanpa masam yang mengganggu. Warna gelapnya menonjol atas pinggan buah.',
          'Sweet Globe — hijau cerah, bulat dan besar, dengan tekstur paling tegas antara semua. Gigitan pertama memang terasa bunyi rangupnya. Manisnya bersih tanpa aroma muscat.',
          'Crimson — merah menyala, rangup, manis dengan sedikit masam di hujung. Masam nipis itulah yang membuatkan ia tidak cepat memualkan, jadi ia pilihan harian yang baik dan biasanya paling berpatutan antara lima.',
        ],
      },
      {
        heading: 'Cara kenal anggur yang segar',
        body: [
          'Tengok tangkainya dahulu, bukan buahnya. Tangkai yang hijau dan lentur bermaksud anggur baru dipetik; tangkai yang coklat, kering dan rapuh bermaksud ia sudah lama dalam simpanan walaupun butirnya masih nampak elok.',
          'Butir anggur sepatutnya melekat kuat pada tangkai. Kalau banyak butir tercicir di dasar bekas, itu tanda ia sudah lama.',
          'Lapisan putih keabuan pada kulit anggur bukan habuk atau racun — itu bloom, lapisan lilin semula jadi yang dihasilkan oleh buah sendiri untuk melindungi daripada kehilangan air. Kehadirannya sebenarnya tanda anggur belum banyak dikendalikan. Ia hilang bila digosok.',
        ],
      },
      {
        heading: 'Cara simpan supaya kekal rangup',
        body: [
          'Jangan basuh sebelum simpan. Air yang tertinggal antara butir mempercepatkan kulat, dan ia juga membuang bloom yang melindungi buah. Basuh hanya bahagian yang hendak dimakan.',
          'Kekalkan anggur pada tangkainya. Butir yang ditanggalkan awal meninggalkan luka kecil di tempat sambungan, dan dari situlah reput bermula.',
          'Simpan dalam peti sejuk di dalam bekas yang ada sedikit pengudaraan — bukan plastik kedap sepenuhnya yang memerangkap lembapan, dan bukan juga terbuka luas yang membuat anggur kering berkedut.',
          'Anggur tidak bertambah manis selepas dipetik. Kalau satu kiriman kurang manis daripada yang sebelumnya, itu bukan kerana cara simpan — itu memang karakter kiriman tersebut.',
        ],
      },
      {
        heading: 'Kalau anggur mula lembik',
        body: [
          'Butir yang mula berkedut masih selamat dimakan dan selalunya lebih manis kerana airnya berkurang. Kalau teksturnya sudah tidak menyenangkan, bekukan — anggur beku dimakan terus dari peti sejuk beku rasanya seperti sorbet mini, dan ia juga sesuai dimasukkan ke dalam smoothie.',
          'Buang butir yang sudah pecah atau berkulat dengan segera. Reput merebak cepat kepada butir bersebelahan dalam bekas yang sama.',
        ],
      },
    ],
    faq: [
      {
        q: 'Kenapa Shine Muscat mahal?',
        a: 'Hasil per pokok lebih rendah berbanding kultivar anggur biasa, penjagaan di ladang lebih rapi, dan permintaannya tinggi. Harga juga berbeza mengikut gred dan asal kiriman.',
      },
      {
        q: 'Anggur mana paling manis?',
        a: 'Shine Muscat, dan ia juga satu-satunya dengan aroma muscat yang wangi. Autumn Royal dan Sweet Globe manis tetapi tanpa keharuman itu; Crimson ada sedikit masam di hujung.',
      },
      {
        q: 'Serbuk putih pada anggur tu apa? Selamat ke?',
        a: 'Itu bloom — lapisan lilin semula jadi yang dihasilkan oleh anggur sendiri untuk mengurangkan kehilangan air. Ia selamat, dan kehadirannya tanda anggur belum banyak dikendalikan. Ia hilang bila digosok atau dibasuh.',
      },
      {
        q: 'Anggur kena basuh sebelum simpan ke?',
        a: 'Jangan. Air yang tertinggal antara butir mempercepatkan kulat dan membuang bloom yang melindungi buah. Basuh hanya sebelum makan.',
      },
      {
        q: 'Kenapa anggur saya cepat gugur dari tangkai?',
        a: 'Butir yang mudah tercicir menandakan anggur sudah agak lama selepas dipetik. Anggur segar melekat kuat pada tangkainya, dan tangkainya masih hijau serta lentur.',
      },
      {
        q: 'Anggur boleh dibekukan?',
        a: 'Boleh, dan ia cara terbaik menyelamatkan anggur yang mula berkedut. Dimakan terus dari peti sejuk beku rasanya seperti sorbet; sesuai juga untuk smoothie.',
      },
    ],
  },
  {
    slug: 'cara-simpan-buah-peti-sejuk',
    title: 'Cara Simpan Buah dalam Peti Sejuk Supaya Tahan Lama',
    description:
      'Bukan semua buah patut masuk peti sejuk. Panduan lengkap: buah mana kena sejuk, buah mana rosak kalau disejukkan, kenapa buah tak boleh disimpan bersama, dan kesilapan paling biasa yang buat buah cepat rosak.',
    updated: '2026-07',
    sections: [
      {
        heading: 'Kesilapan pertama: masukkan semua buah ke peti sejuk',
        body: [
          'Ramai menganggap peti sejuk memanjangkan hayat semua buah. Sebenarnya sebahagian buah tropika rosak apabila disejukkan sebelum masak — proses masaknya terhenti, teksturnya bertukar berkeras atau berair, dan rasanya jadi hambar. Kerosakan ini tidak boleh dipulihkan walaupun buah dikeluarkan semula.',
          'Peraturan mudahnya: buah yang perlu masak lagi, biarkan di suhu bilik dahulu. Setelah cukup masak, barulah masuk peti sejuk untuk memperlahankan proses seterusnya.',
        ],
      },
      {
        heading: 'Buah yang patut terus masuk peti sejuk',
        body: [
          'Semua beri dan buah berkulit nipis: ceri, anggur, strawberi, blueberry. Buah ini tidak akan masak lagi selepas dipetik — yang berlaku hanya penurunan kualiti, dan sejuk memperlahankannya. Setiap jam di suhu bilik Malaysia bermakna hayat yang hilang.',
          'Buah yang sudah dipotong, tanpa kecuali. Permukaan yang terdedah adalah pintu masuk bakteria. Simpan dalam bekas bertutup dan habiskan cepat.',
          'Buah yang sudah cukup masak dan anda belum sempat makan — mangga, avocado, pear yang sudah lembut. Menyejukkan pada tahap ini memberi anda beberapa hari tambahan.',
        ],
      },
      {
        heading: 'Buah yang biar di suhu bilik dahulu',
        body: [
          'Mangga, avocado, pisang, betik dan nanas yang masih keras. Buah ini terus masak selepas dipetik, dan proses itu memerlukan suhu bilik. Menyejukkannya terlalu awal menghentikan proses tersebut secara kekal — buah akan kekal keras tetapi tidak akan jadi manis.',
          'Cara uji kemasakan: tekan lembut di hujung tangkai. Kalau memberi sedikit, ia sudah sedia. Untuk mangga, tambah satu lagi petunjuk — hidu bahagian tangkai; mangga masak berbau wangi walaupun kulitnya masih hijau.',
          'Nak cepat masak? Simpan dalam beg kertas bersama sebiji pisang. Gas etilena daripada pisang mempercepatkan proses.',
        ],
      },
      {
        heading: 'Kenapa buah tidak patut disimpan bercampur',
        body: [
          'Sesetengah buah mengeluarkan gas etilena — antaranya pisang, mangga, betik dan avocado matang. Gas ini mempercepatkan kemasakan buah lain di sekelilingnya.',
          'Itu berguna kalau anda memang mahu buah cepat masak. Ia menjadi masalah apabila pisang diletakkan bersebelahan anggur atau ceri di dalam peti sejuk — buah yang sepatutnya tahan seminggu akan merosot dalam beberapa hari.',
          'Penyelesaian mudah: asingkan pisang dan mangga dari beri dan anggur. Tidak perlu bekas khas, cukup letak di rak berbeza.',
        ],
      },
      {
        heading: 'Basuh atau tidak?',
        body: [
          'Jangan basuh sebelum simpan. Ini peraturan yang paling kerap dilanggar, dan ia punca nombor satu buah cepat berkulat. Lembapan yang tertinggal di permukaan adalah tempat paling sesuai untuk kulat tumbuh.',
          'Basuh hanya bahagian yang hendak dimakan, tepat sebelum makan. Kalau anda terlanjur membasuh semuanya, keringkan betul-betul dengan tuala kertas sebelum menyimpan.',
        ],
      },
      {
        heading: 'Bekas yang betul',
        body: [
          'Bekas kedap sepenuhnya memerangkap lembapan yang dikeluarkan oleh buah, dan itu mempercepatkan reput. Bekas terbuka luas pula membiarkan buah kehilangan air sehingga berkedut.',
          'Yang paling sesuai ialah bekas dengan sedikit pengudaraan — bekas asal penghantaran selalunya sudah direka begitu. Alas dasarnya dengan tuala kertas untuk menyerap lembapan berlebihan, dan tukar bila basah.',
          'Jangan tindih terlalu tebal. Buah di lapisan bawah akan lebam oleh berat di atasnya, dan lebam adalah tempat reput bermula.',
        ],
      },
      {
        heading: 'Bahagian mana dalam peti sejuk?',
        body: [
          'Elakkan pintu. Suhu di situ naik turun setiap kali pintu dibuka, dan turun naik suhu lebih memudaratkan buah daripada suhu sejuk yang stabil.',
          'Bahagian paling dalam dan paling bawah — biasanya laci sayur — adalah yang paling stabil suhunya. Itulah tempat terbaik untuk buah yang sensitif.',
        ],
      },
      {
        heading: 'Bila buah mula merosot, jangan terus buang',
        body: [
          'Buah yang mula berkedut selalunya lebih manis kerana kandungan airnya berkurang. Ia masih sesuai untuk smoothie, jus, atau dibakar dalam kek dan muffin.',
          'Bekukan sebelum ia terlalu jauh. Anggur, ceri dan mangga semuanya sesuai dibekukan — potong, susun sekata atas dulang, bekukan, kemudian pindahkan ke beg kedap udara supaya tidak melekat menjadi satu ketul.',
          'Yang perlu dibuang: buah yang sudah berkulat, berbau masam seperti hendak menjadi cuka, atau berair apabila disentuh. Satu biji berkulat dalam bekas perlu dibuang segera kerana ia merebak kepada yang bersebelahan. [Lihat buah yang ada sekarang](/kategori/buah-import).',
        ],
      },
    ],
    faq: [
      {
        q: 'Semua buah kena masuk peti sejuk ke?',
        a: 'Tidak. Buah yang masih perlu masak — mangga, avocado, pisang, betik, nanas keras — biarkan di suhu bilik dahulu. Menyejukkannya terlalu awal menghentikan proses masak secara kekal. Setelah cukup masak, barulah masuk peti sejuk.',
      },
      {
        q: 'Kenapa buah saya cepat berkulat walaupun dalam peti sejuk?',
        a: 'Punca paling biasa ialah dibasuh sebelum disimpan. Lembapan yang tertinggal adalah tempat kulat tumbuh. Punca lain: bekas terlalu kedap, buah ditindih terlalu tebal, atau disimpan di pintu peti sejuk yang suhunya tidak stabil.',
      },
      {
        q: 'Boleh ke simpan pisang bersama buah lain?',
        a: 'Tidak digalakkan. Pisang mengeluarkan gas etilena yang mempercepatkan kemasakan buah di sekelilingnya. Asingkan pisang dan mangga daripada anggur, ceri dan beri.',
      },
      {
        q: 'Macam mana nak cepatkan mangga atau avocado masak?',
        a: 'Simpan dalam beg kertas bersama sebiji pisang. Gas etilena daripada pisang mempercepatkan proses. Periksa setiap hari — tekan lembut di hujung tangkai; kalau memberi sedikit, ia sudah sedia.',
      },
      {
        q: 'Bahagian mana dalam peti sejuk paling sesuai untuk buah?',
        a: 'Bahagian paling dalam dan paling bawah, biasanya laci sayur. Elakkan pintu kerana suhunya naik turun setiap kali pintu dibuka, dan turun naik suhu lebih memudaratkan daripada sejuk yang stabil.',
      },
      {
        q: 'Buah dah berkedut — masih boleh makan?',
        a: 'Boleh, dan selalunya lebih manis kerana airnya berkurang. Sesuai untuk smoothie, jus atau bakeri. Yang perlu dibuang hanya buah yang berkulat, berbau masam, atau berair apabila disentuh.',
      },
    ],
  },
]

export function getArtikel(slug: string) {
  return ARTIKEL.find((a) => a.slug === slug)
}
