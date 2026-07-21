-- ============================================================
-- 114_seed_descriptions.sql
-- Seed description produk & kategori (SEO).
--
-- Kenapa fail ini wujud: description ditulis terus ke DB, jadi ia tiada
-- dalam kawalan versi. Kalau tertimpa atau terpadam, tiada rollback dari git.
-- Fail ini jaring keselamatan + rekod boleh dibaca dalam repo.
--
-- UPDATE sahaja (bukan INSERT) — produk & kategori mesti sudah wujud.
-- Padan ikut slug. Baris yang slugnya tak dijumpai akan dilangkau senyap.
-- ADDITIVE. Idempotent — selamat dijalankan semula.
--
-- Dijana dari DB production. Jangan edit tangan; jana semula sebaliknya.
-- Kandungan: 106 produk, 33 kategori.
-- ============================================================

-- ── PRODUK (106) ──────────────────────────────────────────────

-- AJWA Aliyah Mix
update public.products set description = $desc$Pilihan campuran ini menghimpunkan kurma Ajwa Aliyah dalam saiz bercampur di dalam satu pek — ada yang sederhana, ada yang lebih besar. Semuanya berkongsi ciri Ajwa yang sama: warna hitam kelam, isi lembut dan manis yang tidak menyengat.

Kerana tidak diasingkan mengikut satu saiz tetap, harganya lebih berpatutan berbanding gred yang disaring ketat. Ia sesuai untuk anda yang mementingkan rasa dan kuantiti lebih daripada keseragaman rupa, seperti bekalan harian keluarga, tabung berbuka, atau agihan kepada jemaah.

Ambil pek 300g atau 500g untuk kegunaan rumah, dan 2kg hingga karton bila perlu jumlah besar. Simpan dalam bekas tertutup rapat supaya kurma kekal lembap dan tidak mengeras.$desc$
  where slug = 'ajwa-aliyah-mix';

-- AJWA Aliyah Premium (Kotak)
update public.products set description = $desc$Datang dalam kotak persembahan yang kemas, pilihan ini memudahkan anda terus menghadiahkan tanpa perlu bungkus semula. Isinya kurma Ajwa Aliyah yang dipilih rapi, hitam berkilat dengan isi lembut dan manis yang lembut di tekak.

Berbanding pek biasa, nilai tambah di sini ialah pembungkusan — sesuai untuk hadiah raya, buah tangan ziarah, cenderahati majlis, atau hantaran korporat kepada pelanggan dan rakan sekerja. Kotak 250g sesuai untuk hadiah ringkas kepada ramai orang, manakala 500g lebih sesuai bila anda mahu bingkisan yang nampak lebih bermakna.

Simpan kotak di tempat sejuk dan kering, elak cahaya matahari terus supaya tekstur kurma kekal lembut sehingga sampai ke tangan penerima.$desc$
  where slug = 'ajwa-aliyah-premium-kotak';

-- AJWA Jumbo
update public.products set description = $desc$Bagi yang mahu biji besar dan berisi, gred Jumbo memberi kurma Ajwa bersaiz ketara lebih besar daripada Large, dengan isi tebal dan permukaan berkedut cantik. Rasanya kekal lembut dan manis halus, cuma setiap biji terasa lebih mewah dan mengenyangkan.

Saiz besar begini menyerlah bila disusun dalam bekas kaca atau dulang, jadi ia pilihan biasa untuk majlis, jamuan pejabat dan hantaran ringkas. Pek 300g dan 500g sesuai sebagai buah tangan, manakala 2kg, 5kg dan karton lebih sesuai untuk penganjur majlis atau peniaga yang jual semula.

Untuk kekalkan kelembapan isinya, simpan dalam bekas kedap udara. Peti sejuk membantu bila cuaca panas, dan biarkan sebentar di suhu bilik sebelum dihidang.$desc$
  where slug = 'ajwa-jumbo';

-- AJWA Large
update public.products set description = $desc$Naik satu tingkat daripada gred Medium, saiz Large memberi biji yang lebih berisi dan padat sambil mengekalkan rasa Ajwa yang lembut serta manis sederhana. Setiap biji terasa lebih penuh di mulut, sesuai untuk anda yang rasa gred sederhana terlalu kecil.

Gred ini sering jadi pilihan tengah — cukup cantik untuk dihidangkan kepada tetamu yang singgah, tetapi masih berpatutan untuk dimakan sendiri setiap hari. Pek 300g dan 500g sesuai untuk simpanan rumah, 1kg dan 2kg untuk keluarga besar, dan 5kg atau karton untuk jamuan serta agihan.

Hidangkan bersama air suam atau susu, atau isi dengan badam bagi menaikkan lagi rasa. Simpan dalam bekas tertutup, jauh daripada cahaya matahari terus.$desc$
  where slug = 'ajwa-large';

-- AJWA Medium
update public.products set description = $desc$Kurma hitam dari Madinah ini terkenal dengan teksturnya yang lembut dan rasa manis yang halus, tidak melekit di tekak. Gred Medium ialah saiz sederhana — muat sekali suap, jadi ia pilihan paling praktikal untuk makan setiap hari, bekal ke pejabat atau juadah berbuka di rumah.

Kerana harganya paling mesra dalam keluarga Ajwa, gred ini sesuai untuk anda yang mahu simpan stok berterusan tanpa fikir panjang. Pek 100g bagus untuk cuba dahulu, 300g dan 500g untuk kegunaan mingguan, manakala 1kg ke atas hingga karton lebih berbaloi untuk bekalan bulanan atau surau dan masjid.

Simpan dalam bekas kedap udara di tempat sejuk dan gelap. Jika cuaca panas, masukkan ke dalam peti sejuk supaya teksturnya kekal lembut.$desc$
  where slug = 'ajwa-medium';

-- AJWA Super Jumbo VIP
update public.products set description = $desc$Inilah pilihan tertinggi dalam susunan gred Ajwa. Biji disaring pada saiz paling besar dan bentuk paling seragam, memberi penampilan menyerlah dengan isi tebal serta tekstur lembut yang menjadi kegemaran peminat kurma Madinah.

Oleh sebab rupa dan saiznya, gred VIP paling kerap dibeli sebagai hadiah, bingkisan raya, atau hidangan untuk tetamu istimewa dan majlis rasmi. Kalau anda mahu sesuatu yang nampak berkelas tanpa perlu bungkusan tambahan, gred inilah jawapannya.

Pek 100g sesuai untuk merasa, 500g cantik sebagai buah tangan, dan 1kg ke atas hingga karton untuk anda yang memang setia dengan Ajwa bersaiz besar. Simpan dalam bekas kedap udara di tempat sejuk dan gelap.$desc$
  where slug = 'ajwa-super-jumbo-vip';

-- Roasted Almond
update public.products set description = $desc$Rangup di setiap gigitan dengan rasa berkacang yang lembut, badam panggang ini jadi teman senyap masa anda bekerja, memandu jauh atau membaca malam-malam.

Selain dimakan terus sebagai snek, anda boleh cincang kasar dan taburkan atas oat, salad, ais krim atau kek. Teksturnya yang padat membuatkan bunyi rangup itu kekal walaupun sudah dicampur dalam hidangan lain.

Pek 100g sesuai kalau anda nak cuba dahulu atau bawa dalam beg. Pek 500g padan untuk stok rumah sepanjang minggu, manakala 1kg lebih berbaloi bagi anda yang memang makan hari-hari atau kerap guna untuk membakar kuih.

Simpan dalam bekas tertutup rapat, jauh dari haba dan kelembapan supaya kerangupannya kekal. Harga bermula RM14 sepek.$desc$
  where slug = 'almond';

-- Anggur Autumn Royal 
update public.products set description = $desc$Anggur hitam keunguan bersaiz besar dan berbentuk bujur, tanpa biji langsung. Setiap butir rangup bila digigit dan manis sekata sehingga hujung, tanpa rasa masam yang mengganggu.

Warna gelap pekatnya menjadikan ia menonjol atas pinggan buah, sesuai untuk hidangan tetamu, bekal anak ke sekolah, atau teman kerja di meja pejabat. Kerana tiada biji, anak kecil pun boleh makan sendiri tanpa perlu diawasi.

Pek 500g cukup untuk snek peribadi, 1kg untuk keluarga, dan 2kg bila ada majlis atau anda memang membeli setiap minggu. Bilas hanya sejurus sebelum makan, dan simpan dalam peti sejuk di dalam bekas bertutup. Bermula RM19 sepek.$desc$
  where slug = 'Anggur-Autumn-Royal';

-- Anggur Shine Muscat
update public.products set description = $desc$Anggur hijau dari Jepun yang menjadi sebutan ramai kerana rasanya memang berbeza. Aroma muscat yang wangi bergabung dengan manis yang sangat tinggi, dan kulitnya nipis sehingga boleh terus dimakan tanpa perlu dikupas — tiada biji langsung.

Butir buahnya besar, rangup, dan berwarna hijau kekuningan bila cukup matang. Paling sesuai dijadikan hadiah, hidangan istimewa untuk tetamu, atau layanan diri sendiri hujung minggu. Sedap juga dihiris ke dalam salad atau dihidang sejuk bersama keju.

Pada RM15.90 sepek, inilah cara paling mudah untuk mencuba anggur premium. Simpan dalam peti sejuk bersama tangkainya dan bilas sebelum makan.$desc$
  where slug = 'anggur-shine-muscat';

-- Anggur Sweet Sapphire
update public.products set description = $desc$Bentuknya yang memanjang seperti jari membuatkan orang terus perasan — ini bukan anggur biasa. Sweet Sapphire berwarna ungu gelap hampir kehitaman, tanpa biji, dengan tekstur rangup dan rasa manis yang pekat.

Kerana bentuknya unik dan mudah dipegang, ia sangat sesuai untuk platter buah, bekal sekolah, atau hidangan majlis yang mahu nampak lain daripada yang lain. Boleh juga disejukkan betul-betul dan dimakan sebagai snek pada hari panas.

Harga RM20 sepek. Simpan dalam peti sejuk bersama tangkainya di dalam bekas bertutup, dan bilas hanya sebelum makan supaya kulitnya kekal tegang dan rangup.$desc$
  where slug = 'anggur-sweet-sapphire';

-- Apple Fuji XL 
update public.products set description = $desc$Kalau anda mencari epal yang benar-benar rangup dan berair, Fuji jawapannya. Kultivar asal Jepun ini terkenal dengan tekstur padat berkerisik dan manis yang tinggi, tanpa rasa kelat mengganggu.

Saiz XL bermaksud sebiji sudah cukup mengenyangkan untuk snek pagi atau petang. Sesuai dibawa ke pejabat, dimasukkan dalam bekal anak, dihiris nipis untuk salad, atau dicicah mentega kacang.

Hanya RM2 sebiji. Pek 3 biji sesuai untuk cuba dahulu atau bekalan beberapa hari, manakala 5 biji lebih berbaloi untuk keluarga yang makan epal setiap hari. Simpan dalam peti sejuk supaya kekal rangup, dan keluarkan sebentar sebelum dimakan untuk rasa terbaik.$desc$
  where slug = 'apple-fuji-xl';

-- Aprikot Kering
update public.products set description = $desc$Aprikot kering tulen dari Turki — negara pengeluar aprikot terbesar di dunia. Tiada gula tambahan; manisnya datang sepenuhnya dari buah itu sendiri.

Teksturnya lembut dan kenyal, bukan jenis keras yang perlu direndam dahulu. Rasanya manis masam seimbang dengan sedikit rasa madu di hujung.

Sesuai dimakan terus sebagai snek, dicampur dalam oat atau granola, dimasukkan dalam air rendaman, atau dihidang ketika berbuka. Popular juga sebagai buah tangan.

Ada tiga saiz: 100g untuk cuba rasa, 500g untuk keluarga, dan 1kg yang paling berbaloi — RM59 berbanding RM75 jika beli lima pek 100g.

Simpan dalam bekas tertutup di tempat sejuk dan kering.$desc$
  where slug = 'aprikot-kering';

-- Aprikot Turkey
update public.products set description = $desc$Aprikot SEGAR dari Turki — bukan aprikot kering. Kulitnya lembut berbulu halus, isinya oren keemasan, berair dan ringan; lebih hampir kepada peach kecil berbanding buah kering yang pekat manisnya.

Setiap biji sekitar 30 hingga 50 gram — saiz yang sesuai dimakan sekali suap.

Manis dengan sedikit masam di hujung. Sesuai dimakan terus sejuk-sejuk, dipotong dalam yogurt, atau dihidang sebagai pencuci mulut.

Diimport dan disimpan sejuk sepanjang perjalanan. Beli 3 atau 5 pek untuk harga lebih baik.

Simpan dalam peti sejuk.$desc$
  where slug = 'aprikot-turkey';

-- Avocado Kenya
update public.products set description = $desc$Avocado Hass dari Kenya — jenis avocado paling dikenali di dunia, dengan isi berkrim padat dan rasa berkacang yang pekat. Kulitnya bertekstur kasar dan bertukar gelap apabila masak.

Setiap biji lebih kurang 100 gram — saiz sekali guna, sesuai untuk sandwich atau separuh alpukat dengan garam.

Ujian masak: tekan lembut di hujung tangkai. Kalau memberi sedikit, ia dah sedia. Kalau masih keras, biarkan di suhu bilik sehingga lembut — nak cepat, simpan dalam beg kertas bersama pisang.

Sesuai untuk salad, sandwich, smoothie, guacamole, atau dimakan terus. Sumber lemak baik.

Beli 3 atau 5 biji untuk harga lebih baik — boleh dibiarkan masak berperingkat supaya ada bekalan sepanjang minggu.$desc$
  where slug = 'avocado';

-- Avocado Vietnam Big Long
update public.products set description = $desc$Avocado Vietnam jenis panjang — bentuknya memanjang seperti buah pear, bukan bulat seperti Hass, dan saiznya jauh lebih besar.

Sekilo hanya 2 hingga 3 biji, bermakna satu biji sekitar 350 gram ke atas — lebih tiga kali ganda saiz avocado Hass biasa. Inilah pilihan bila anda perlukan isi banyak: smoothie sekeluarga, bubur bayi, atau guacamole untuk kenduri.

Isinya berkrim sama seperti avocado lain, dengan rasa yang lembut dan tidak terlalu pekat.

Ujian masak: tekan lembut di hujung tangkai. Kalau memberi sedikit, ia dah sedia. Kalau masih keras, biarkan di suhu bilik sehingga lembut.

Dijual ikut kilogram. Simpan di suhu bilik sehingga masak, kemudian pindah ke peti sejuk.$desc$
  where slug = 'avocado-vietnam-big-long';

-- Betik Sekaki
update public.products set description = $desc$Betik tempatan manis, sesuai untuk sajian harian.$desc$
  where slug = 'betik-sekaki';

-- Blueberry (125Gram)
update public.products set description = $desc$Beri biru kecil yang manis masam ini antara buah paling senang dimakan begitu sahaja, bilas sikit terus boleh cedok. Perhatikan lapisan lilin nipis keputihan pada kulitnya, itu bloom semula jadi dan tanda beri masih segar, bukan kecacatan.

Rasanya seimbang antara manis dan masam, jadi ia serasi dengan yogurt, oat pagi, pancake, atau dibancuh dalam smoothie. Anak kecil pun suka kerana saiznya muat terus dalam mulut.

Ambil 1 pek 125 gram kalau sekadar nak snek beberapa hari. Pek 3 dan 5 lebih berbaloi kalau anda memang guna setiap pagi atau suka membakar di rumah. Simpan dalam peti sejuk dan basuh ikut keperluan sahaja.$desc$
  where slug = 'blueberry';

-- Buah Naga Merah (A)
update public.products set description = $desc$Potong dua, cedok dengan sudu — semudah itu. Isi merah keunguan dengan biji hitam halus yang boleh terus dimakan, rasanya manis lembut dan menyegarkan, sesuai untuk sesiapa yang tidak gemar buah terlalu manis.

Gred A bermaksud saiznya lebih besar, jadi isi yang anda dapat pun lebih banyak. Sedap dimakan sejuk terus dari peti, dikisar jadi smoothie, atau dipotong dadu untuk salad buah dan topping yogurt. Warnanya juga cantik bila dihidang kepada tetamu.

Pek 1kg sesuai untuk keluarga kecil atau kali pertama mencuba, manakala 2kg lebih berbaloi untuk rumah yang memang makan buah setiap hari. Simpan dalam peti sejuk dan basuh sebelum dipotong. Harga RM7.90 sekilogram.$desc$
  where slug = 'buah-naga-merah-a';

-- Buah Tin Kering
update public.products set description = $desc$Lembut, kenyal dan manis seperti madu, dengan biji halus yang memberi bunyi rangup setiap kali dikunyah. Itulah keistimewaan buah tin kering berbanding buah kering lain yang biasa.

Boleh dimakan terus sebagai snek mengenyangkan, dihiris masuk dalam oat, dicampur dengan kacang dan keju, atau direndam sekejap dalam air suam sebelum digunakan dalam masakan dan bakeri. Ramai juga menjadikannya pilihan waktu berbuka.

Pek 100 gram untuk cuba rasa, 500 gram untuk simpanan rumah, dan 1kg kalau ia dah jadi rutin harian atau untuk hidangan majlis. Simpan dalam bekas tertutup di tempat sejuk dan kering supaya tidak melekat antara satu sama lain.$desc$
  where slug = 'buah-tin-kering';

-- Campur Potong Tropical
update public.products set description = $desc$Tembikai + Nanas + Betik dipotong. Sesuai untuk pejabat.$desc$
  where slug = 'campur-potong-tropical';

-- Century Pear
update public.products set description = $desc$Kulit kuning keemasan dan isi putih yang padat berair — inilah pear China yang jadi kegemaran ramai. Setiap gigitan rangup, airnya keluar penuh di mulut, dengan manis lembut yang tidak melekit di tekak.

Saiznya sesuai dipegang tangan dan boleh dimakan terus selepas dibasuh, tanpa perlu dikupas. Sesuai jadi pencuci mulut selepas makan, bekal ke sekolah atau pejabat, dan sedap dihiris masuk salad buah.

Pada RM2 sebiji, anda boleh ambil satu biji dahulu untuk merasa, atau terus set 3 biji kalau nak simpan stok buah di rumah untuk seisi keluarga. Simpan dalam peti sejuk supaya teksturnya kekal rangup dan sejuk bila digigit.$desc$
  where slug = 'century-pear';

-- Cherry Fresh Turki Saiz Besar 28mm++
update public.products set description = $desc$Diukur pada 28mm ke atas garis pusat, inilah saiz jumbo yang jarang jumpa di pasaran. Sebiji boleh memenuhi hujung jari anda, dan gigitannya terasa jauh lebih berisi berbanding ceri saiz biasa.

Dari Turki, ceri sebegini gelap hampir keunguan dengan isi padat dan manis pekat. Sebab saiznya yang menonjol, ia paling sesuai untuk pinggan hidangan majlis, dulang buah kenduri, atau hantaran yang nak nampak mewah tanpa banyak susunan.

Mula dengan pek 250 gram berserta 250 gram percuma kalau nak uji saiz ini dulu. Pek 1kg dan 2kg untuk kegunaan rumah, manakala pek 2kg berserta 2kg percuma dan pek 5kg untuk majlis atau bekalan besar. Simpan sejuk, basuh bila nak makan sahaja.$desc$
  where slug = 'ceri-fresh-turki';

-- Cherry Turkey - VIP
update public.products set description = $desc$Untuk anda yang dah biasa dengan ceri Turki dan mahu biji yang lebih besar serta lebih konsisten, gred VIP pada RM60 sekilogram ini pilihan harian yang berbaloi.

Bijinya gelap, padat dan pecah rangup bila digigit, dengan manis pekat yang tidak berair. Sesuai jadi bekalan tetap di rumah, hidangan meja masa cuti sekolah, atau dibawa ke rumah terbuka.

Pek 500 gram cukup untuk cuba gred ini. Pek 1kg dan 2kg lebih sesuai untuk keluarga yang memang makan ceri setiap hari, manakala pek 3kg dan 5kg berbaloi bila anda nak agih-agihkan kepada saudara atau simpan untuk beberapa hari. Simpan sentiasa dalam peti sejuk dan jangan basuh awal.$desc$
  where slug = 'cherry-turkey---vip';

-- Cherry Turkey (100Gram)
update public.products set description = $desc$Nak tahu dulu macam mana rasa ceri Turki sebenar sebelum beli banyak? Pek 100 gram pada harga RM9 ini pilihan paling ringan untuk anda mula.

Turki merupakan pengeluar ceri terbesar di dunia, dan ceri dari sana memang terkenal dengan warna gelap serta manis yang pekat. Dalam pek kecil ini anda dapat beberapa genggam sahaja, cukup untuk sekali makan, dijadikan topping atas yogurt, atau diselit dalam bekal anak ke sekolah.

Ceri buah yang sangat mudah rosak. Simpan dalam peti sejuk sebaik sahaja sampai dan jangan basuh sehingga tiba masa nak makan, supaya kulitnya kekal kering dan rangup.$desc$
  where slug = 'cherry-turkey-100gram';

-- Cherry Turkey (250gram)
update public.products set description = $desc$Bila satu pek kecil dah tak cukup tetapi anda belum mahu komited dengan sekilo penuh, saiz 250 gram pada RM30 ini yang paling masuk akal.

Ceri Turki mempunyai kulit gelap berkilat, isi padat dan manis yang pekat berbanding ceri biasa. Kuantiti ini sesuai untuk dikongsi satu keluarga kecil sekali duduk, dihidang dalam mangkuk masa tetamu datang, atau dibawa melawat orang tanpa perlu beli pek besar.

Biarkan ceri dalam bekas berlubang di dalam peti sejuk dan keluarkan sedikit sebelum makan supaya rasa manisnya lebih menyerlah. Basuh hanya bahagian yang nak dimakan.$desc$
  where slug = 'cherry-turkey-250gram';

-- Cherry Turkey VVIP
update public.products set description = $desc$Gred paling tinggi dalam susunan ceri Turki kami, pada RM69 sekilogram. VVIP dipilih untuk biji yang lebih besar, warna lebih gelap dan rasa manis yang lebih pekat berbanding gred VIP.

Kerana rupanya kemas dan seragam, ia paling sesuai bila anda nak beri sebagai hadiah, bawa ke rumah mertua, atau hidang kepada tetamu penting. Cukup letak atas pinggan putih, tak perlu apa-apa hiasan lain.

Pek 500 gram sesuai untuk hadiah kecil, 1kg untuk hadiah biasa, manakala 2kg dan 5kg pula untuk majlis atau agihan ramai. Pastikan disimpan sejuk sepanjang masa dan hanya dibasuh sejurus sebelum dimakan.$desc$
  where slug = 'cherry-turkey-vvip';

-- Cherry USA 28mm+
update public.products set description = $desc$Datang dari musim panas belahan utara Amerika Syarikat, ceri ini masuk pada waktu berbeza daripada ceri Turki, jadi anda masih boleh dapat ceri segar bila musim Turki reda.

Warnanya merah gelap, teksturnya rangup dan rasanya manis dengan sedikit sentuhan masam yang menyegarkan. Saiz 28mm ke atas menjadikannya besar dan berisi, tetapi pada harga RM30 sekilogram ia pilihan paling berpatutan untuk saiz sebegitu.

Pek 500 gram sesuai untuk cuba, 1kg untuk bekalan seminggu di rumah, dan 2kg bila ramai yang makan. Masukkan ke dalam peti sejuk sebaik sampai dan elak membasuh awal supaya isinya tidak cepat lembik.$desc$
  where slug = 'cherry-usa';

-- CN Winter Jujube
update public.products set description = $desc$Buah bidara yang satu ini kecil, bulat, berkulit hijau bercampur merah, dan rangup macam epal mini bila digigit. Rasanya manis segar dengan air yang menyegarkan, dan boleh terus dimakan bersama kulit tanpa perlu dikupas.

Saiznya muat dalam genggaman kanak-kanak, jadi memang lahir untuk jadi snek. Basuh, keringkan, letak dalam mangkuk atas meja — habis tanpa anda sedar. Sesuai juga dihidang untuk tetamu atau dibawa sebagai bekal ringan sepanjang hari.

Satu pack berharga RM19.90. Simpan dalam peti sejuk dalam keadaan kering supaya teksturnya kekal rangup, kerana jujube yang lembap cepat hilang rangupnya.$desc$
  where slug = 'cn-winter-jujube';

-- Combo Set ( Ceri Turkey + Donut Peach Uzbek + Apricot Turkey
update public.products set description = $desc$Combo buah import eksklusif SyababFresh — Ceri Turki + BONUS Donut Peach & Aprikot Uzbekistan. Semua diimport sendiri, fresh cold-chain. Keluarga Besar dapat FREE penghantaran!$desc$
  where slug = 'combo-ceri-import';

-- Crimson Grapes
update public.products set description = $desc$Anggur merah tanpa biji yang menjadi pilihan harian ramai keluarga. Warnanya merah menyala, teksturnya rangup, dan rasanya manis dengan sedikit masam di hujung — cukup seimbang untuk dimakan banyak tanpa cepat jemu.

Sedikit rasa masam itulah yang menjadikan Crimson sesuai dicampur dalam salad, dihidang bersama keju, atau dijadikan snek tengah hari. Anak-anak pun senang makan kerana tiada biji.

Pek 500g sesuai untuk seorang, 1kg untuk keluarga, dan 2kg kalau anda membeli untuk seminggu atau untuk kenduri. Simpan dalam peti sejuk dan bilas hanya sebelum makan. Bermula RM14.90 sepek, antara anggur paling berbaloi di kedai kami.$desc$
  where slug = 'crimson-grapes';

-- Delima India
update public.products set description = $desc$Delima dari India ini penuh dengan biji merah berkilat yang manis dan berair. Sebaik dibelah, isinya kelihatan seperti permata — sebab itulah ia sering jadi pilihan untuk hidangan tetamu dan majlis.

Cara paling mudah membukanya: kerat kulit ikut garisan, belah dalam mangkuk berisi air, kemudian tanggalkan bijinya supaya tidak berterabur. Makan terus, tabur atas salad dan yogurt, atau perah jadi jus delima segar.

Harga RM11 sebiji dengan pilihan 1, 3 atau 5 biji untuk kegunaan rumah. Kalau anda peniaga, kaki jus, atau nak agihkan untuk keluarga besar, pilihan karton 1 hingga 3 ctn lebih berbaloi. Simpan di tempat sejuk berudara, dan masukkan ke peti sejuk selepas dibelah.$desc$
  where slug = 'delima-india';

-- Donut Peach Spain
update public.products set description = $desc$Bentuknya leper seperti donut kecil — itulah sebabnya peach jenis ini turut dikenali sebagai Saturn peach. Berbanding peach bulat biasa, rasanya lebih manis dan kurang masam, isinya putih lembut, dan bijinya kecil sehingga senang ditanggalkan dengan jari.

Buah ini datang dari Sepanyol, salah satu pengeluar peach utama Eropah dengan musim panas Mediterranean yang panjang dan cerah. Dijual ikut kilogram pada RM25, jadi anda dapat campuran saiz dalam satu pek dan boleh makan terus tanpa kupas.

Satu pek cukup untuk merasa dan dikongsi sekeluarga; dua pek lebih berbaloi kalau nak stok atau bawa ke rumah terbuka. Biar di suhu bilik sehingga empuk, kemudian simpan dalam peti sejuk.$desc$
  where slug = 'donut-peach-spain';

-- Donut Peach Turkey (500Gram)
update public.products set description = $desc$Turki antara negara pengeluar peach terbesar dunia, dan peach leper dari sana terkenal dengan aromanya yang kuat sebaik pek dibuka. Isinya putih, manisnya pekat dengan masam yang sangat sedikit, dan biji kecil di tengah mudah ditanggalkan begitu sahaja.

Setiap pack berisi 500 gram pada harga RM24.90, saiz yang kemas untuk dihabiskan tanpa membazir. Pilih 1 pack kalau baru nak cuba, 3 pack untuk keluarga yang memang kaki buah, dan 5 pack kalau nak kongsi dengan jiran atau bawa ke majlis.

Sedap dimakan terus, dihiris atas yogurt, atau jadi topping pancake. Biar di suhu bilik sehingga sedikit empuk, kemudian masukkan ke dalam peti sejuk.$desc$
  where slug = 'donut-peach-turkey';

-- Donut Peach Uzbekistan 500g/pack
update public.products set description = $desc$Di Uzbekistan, siang yang panas dan malam yang sejuk membuatkan buah di sana mengumpul gula dengan baik — dan itu memang terasa pada peach leper ini. Manisnya jelas, masamnya nipis, isi putihnya lembut dengan biji kecil yang mudah tanggal.

Inilah pilihan paling mesra bajet antara donut peach kami: RM22.90 untuk pack 500 gram. Ambil 1 pek untuk cuba dahulu, 2 pek untuk stok mingguan rumah, atau 3 pek kalau anak-anak memang laju menghabiskan buah.

Makan terus sebagai snek petang, potong untuk bekal sekolah, atau hidang sejuk selepas makan malam. Biarkan di suhu bilik sehingga wangi dan sedikit empuk, kemudian simpan dalam peti sejuk.$desc$
  where slug = 'donut-peach-uzbekistan';

-- Dry Sukkari
update public.products set description = $desc$Kurma Sukkari dari Arab Saudi terkenal dengan warna kuning keemasan dan rasa manis yang jelas — namanya sendiri berasal daripada perkataan gula. Versi kering ini mempunyai tekstur lebih pejal dan sedikit rangup di gigitan pertama sebelum terasa manis lembut di dalam.

Kerana ia kering, pengendaliannya mudah: boleh disimpan pada suhu bilik dalam bekas kedap udara, senang dibawa ke mana-mana dan tidak berair. Sesuai untuk bekal kerja, snek pemandu, hidangan di pejabat, atau simpanan tetap di dapur.

Pek 100g sesuai untuk mencuba, 500g dan 1kg untuk kegunaan rumah, manakala 2kg, 3kg dan karton lebih berbaloi untuk keluarga besar dan peniaga. Sedap diminum bersama kopi atau teh tanpa gula.$desc$
  where slug = 'dry-sukkari';

-- Durian Duri Hitam
update public.products set description = $desc$Durian D200 Duri Hitam — stok terhad musim ini.$desc$
  where slug = 'durian-duri-hitam';

-- Durian Musang King
update public.products set description = $desc$Durian premium Musang King dari Pahang. Isi tebal, manis dan creamy.$desc$
  where slug = 'durian-musang-king';

-- Epal Fuji Jepun
update public.products set description = $desc$Epal Fuji Jepun, manis dan crispy.$desc$
  where slug = 'epal-fuji-jepun';

-- Forella Pear
update public.products set description = $desc$Pear bersaiz kecil dari Afrika Selatan yang mudah dikenali — kulit hijau bertompok bintik merah yang cantik. Teksturnya rangup dan rasanya manis segar, tidak selembik pear jenis lain.

Saiznya yang kecil menjadikan ia pilihan terbaik untuk bekal sekolah dan snek dalam beg, kerana boleh habis sekali makan tanpa perlu disimpan separuh. Sedap juga dihiris ke dalam salad atau dihidang bersama keju.

Pada RM3 sebiji, anda boleh mula dengan 1 biji untuk merasa, ambil 3 atau 5 biji untuk bekalan seminggu, atau 10 biji kalau seisi rumah memang makan pear. Simpan dalam peti sejuk supaya kekal rangup, atau di suhu bilik kalau mahukan tekstur lebih lembut.$desc$
  where slug = 'forella-pear';

-- Fresh Aprikot Uzbekistan 500g/pack
update public.products set description = $desc$Aprikot segar dari Uzbekistan — dikenali lebih manis dan lebih besar daripada aprikot biasa, hasil iklim lembah pergunungan Asia Tengah yang panas di siang hari dan sejuk pada malam.

Isinya padat dan berair, manis pekat dengan masam yang halus. Bijinya senang ditanggalkan — belah dua dengan ibu jari.

Bermusim Jun hingga Ogos sahaja, dan hanya ada ketika kiriman masuk. Diimport dan disimpan sejuk sepanjang perjalanan.

Setiap pek 500 gram. Makan terus, atau hidang sejuk sebagai pencuci mulut.

Simpan dalam peti sejuk.$desc$
  where slug = 'fresh-aprikot-uzbekistan';

-- Green Kiwi Zespri
update public.products set description = $desc$Isi hijau terang dengan bulatan biji hitam halus di tengah, inilah kiwi yang paling ramai kenal. Zespri ialah jenama kiwi dari New Zealand, dan versi hijau ini bertekstur lebih padat serta rasanya masam manis yang menyegarkan.

Masam yang ada padanya membuatkan ia sedap dimakan selepas makan berat, dipotong dalam salad buah, atau dihiris nipis atas pavlova dan cheesecake. Cara paling mudah, belah dua dan sudu terus isinya.

Satu pek RM21 mengandungi 4 biji, sesuai untuk seorang atau dua orang sepanjang minggu. Kalau masih keras, biarkan di suhu bilik sehingga sedikit lembut bila ditekan, kemudian simpan dalam peti sejuk.$desc$
  where slug = 'green-kiwi-zespri';

-- Grilled Corn RTE
update public.products set description = $desc$Jagung bakar tanpa perlu beratur di gerai tepi jalan. Produk ini Ready To Eat (RTE), bermakna ia sudah dimasak dan anda cuma perlu memanaskannya mengikut arahan pada pembungkusan sebelum dimakan.

Rasa manis jagung dengan aroma bakar yang biasa anda cari itu buat ia sesuai jadi snek petang, teman menonton perlawanan bola, atau pengisi perut ringan bila malas nak masak. Boleh dimakan terus, atau ditanggalkan isinya untuk sup dan salad.

Ambil 1 pek kalau nak cuba dahulu. Pek 5 padan untuk keluarga atau bekal hujung minggu, manakala pek 10 lebih berbaloi bila ada tetamu ramai atau anda mahu simpan stok.

Ikut cadangan penyimpanan pada label dan biarkan bungkusan tertutup sehingga tiba masa hendak dipanaskan. Harga RM7 sepek.$desc$
  where slug = 'grilled-corn-rte';

-- Hami Melon
update public.products set description = $desc$Melon dari Xinjiang ini mudah dikenali dengan kulit berjaringnya dan isi oren cerah di dalam. Rasanya sangat manis dengan tekstur rangup yang lain daripada melon biasa — bukan lembik, tetapi renyah bila dikerat.

Belah dua, buang biji, kemudian hiris bulan sabit atau potong kiub. Sesuai dihidang sejuk waktu petang, jadi buah meja untuk tetamu, atau diblend menjadi jus dan smoothie. Anak-anak biasanya cepat suka kerana manisnya bersih dan tidak berbau tajam.

Harga RM19 sebiji. Ambil sebiji untuk keluarga kecil, dua atau tiga biji kalau ada majlis atau nak stok. Melon yang belum dibelah simpan di tempat sejuk berudara; sebaik dipotong, tutup rapat dan masuk peti sejuk.$desc$
  where slug = 'hami-melon';

-- Harumanis Origional Surabaya
update public.products set description = $desc$Mangga premium yang datang dari Surabaya, Indonesia. Cirinya memang menyerlah: isi tebal tanpa serabut, manis pekat, dan wangi menyapa sebaik kulitnya dikupas.

Teksturnya lembut tetapi padat, jadi senang dihiris kiub tanpa berair merata. Sedap dimakan terus, dihidang sejuk selepas makan, dijadikan mango sticky rice, puding, atau topping air batu campur. Kerana tiada serabut, ia pilihan selesa untuk kanak-kanak dan warga emas.

Dijual ikut kilogram pada RM29.90 — 1kg untuk merasa, 3kg untuk keluarga atau buah tangan, dan 5kg kalau nak stok sepanjang musim. Mangga yang masih keras biar di suhu bilik sehingga wangi, kemudian masuk peti sejuk.$desc$
  where slug = 'harumanis-origional-surabaya';

-- Jambu Batu Pink
update public.products set description = $desc$Jambu batu dari Thailand dengan isi merah jambu yang lembut dan manis — bukan jenis putih yang keras dan kesat. Rangup bila digigit, wangi semula jadi, dan cukup manis untuk dimakan terus tanpa garam atau asam boi.

Disimpan sejuk sebaik sampai supaya isinya kekal padat, bukan lembik.

Sesuai dimakan terus, dipotong untuk bekal sekolah, atau dijus tanpa gula tambahan. Kaya vitamin C.

Dijual ikut kilogram — 1kg lebih kurang 4 hingga 5 biji bergantung saiz. Basuh sebelum makan; boleh dimakan dengan kulit sekali.

Simpan dalam peti sejuk untuk kekalkan kerangupan.$desc$
  where slug = 'jambu-batu-pink';

-- Jambu Batu Seedless
update public.products set description = $desc$Jambu batu tanpa biji — semua isi, tiada bahagian keras di tengah yang perlu dibuang. Pilihan paling senang untuk kanak-kanak dan warga emas yang tak gemar biji jambu yang keras.

Isinya putih, rangup dan manis sederhana. Potong terus hujung ke hujung tanpa pembaziran.

Sesuai untuk bekal, salad buah, rojak, atau dimakan terus. Disimpan sejuk sepanjang perjalanan supaya kekal padat.

Dijual ikut kilogram — 1kg lebih kurang 4 hingga 5 biji bergantung saiz.

Simpan dalam peti sejuk untuk kekalkan kerangupan.$desc$
  where slug = 'jambu-batu-seedless';

-- Jus Delima
update public.products set description = $desc$Warnanya merah gelap pekat dan rasanya manis bercampur masam yang menyegarkan. Jus delima memang bukan minuman yang lemah rasa, sekali teguk anda terus tahu bezanya.

Paling sedap dihidang sejuk. Anda boleh minum terus dari botol, tuang atas ais, atau jadikan asas mocktail bila ada tetamu di rumah. Ramai juga memilihnya sebagai ganti air manis biasa masa berbuka atau selepas bersenam.

Pilihan 1 botol sesuai untuk cuba rasa dahulu. Set 3 dan 6 botol padan untuk kegunaan harian di rumah, manakala 12 dan 24 botol biasanya dipilih untuk majlis, pejabat, atau keluarga besar.

Simpan di tempat sejuk dan elak cahaya matahari terus. Sejukkan sebelum hidang untuk rasa terbaik. Harga RM15 sebotol.$desc$
  where slug = 'jus-delima';

-- Kismis Black Jumbo
update public.products set description = $desc$Bersaiz jauh lebih besar daripada kismis hitam biasa, setiap biji terasa padat dan berisi bila dikunyah. Manisnya pekat dan gelap, jenis yang kekal terasa lama di lidah.

Kerana saiznya besar, ia menonjol bila dicampur dalam bubur, nasi minyak, kek buah atau granola buatan sendiri. Ramai juga makan terus sebagai snek waktu petang atau bekal dalam beg.

Pek 100 gram sesuai untuk cuba rasa dulu atau bekal sekejap. Pek 500 gram untuk kegunaan dapur biasa, manakala 1kg berbaloi kalau anda memang selalu membakar atau berniaga makanan. Simpan dalam bekas kedap udara di tempat sejuk dan kering, jauh dari cahaya matahari.$desc$
  where slug = 'kismis-black-jumbo';

-- Kismis Golden
update public.products set description = $desc$Warnanya keemasan cerah, bukan hitam, dan itulah yang paling membezakannya. Teksturnya lebih lembut manakala rasanya manis dengan sedikit sentuhan masam yang lebih ringan berbanding kismis hitam.

Sebab rasanya tidak terlalu berat, ia sesuai dicampur dalam salad, roti, biskut, kuih raya, atau ditabur atas oat dan sereal pagi. Warnanya juga cantik bila digunakan sebagai hiasan pada hidangan berwarna cerah.

Pek 100 gram cukup untuk mencuba atau sekali guna dalam resipi. Pek 500 gram sesuai untuk dapur yang aktif, dan 1kg untuk anda yang kerap membuat kuih. Simpan dalam bekas tertutup rapat di tempat sejuk dan kering supaya ia kekal lembut.$desc$
  where slug = 'kismis-golden';

-- Kismis Golden Jumbo
update public.products set description = $desc$Gabungan dua perkara yang orang cari, warna keemasan dan saiz jumbo. Setiap biji lebih besar daripada kismis golden biasa, jadi teksturnya lebih kenyal berisi sambil mengekalkan rasa manis lembut yang sedikit masam.

Saiz besar ini buat ia nampak menonjol bila ditabur atas kek, puding, salad atau dulang kacang dan buah kering untuk tetamu. Makan terus pun memuaskan kerana satu biji dah terasa penuh.

Pada RM13 sepek, harganya sedikit lebih tinggi daripada golden biasa kerana saiznya. Ambil 100 gram untuk cuba, 500 gram untuk simpanan dapur, dan 1kg untuk majlis atau kegunaan berterusan. Simpan dalam bekas kedap udara di tempat kering.$desc$
  where slug = 'kismis-golden-jumbo';

-- Kismis Sultana
update public.products set description = $desc$Dihasilkan daripada anggur Sultana tanpa biji, kismis ini bersaiz lebih kecil, berwarna keemasan dan rasanya manis lembut tanpa rasa pekat yang berat.

Kerana halus dan tidak berbiji, ia mudah bercampur rata dalam doh roti, kek, bubur, nasi tomato dan kuih tradisional tanpa mengganggu tekstur. Anak kecil dan orang tua pun senang makan.

Inilah kismis paling tinggi harganya dalam senarai kami, RM17, dan hanya ditawarkan dalam pek 500 gram serta 1kg. Pek 500 gram sesuai untuk dapur rumah, manakala 1kg untuk anda yang membakar kerap atau berniaga. Simpan dalam bekas kedap udara di tempat sejuk dan kering supaya ia tidak mengeras.$desc$
  where slug = 'kismis-sultana';

-- Kiwi Kering
update public.products set description = $desc$Hirisan bulat kiwi yang dikeringkan, kekal hijau di tengah dengan corak biji halus yang cantik. Rasanya manis masam dan teksturnya kenyal, bukan rangup, jadi ia sedap dikunyah perlahan.

Masam ringannya menjadikan ia snek yang tidak muak walaupun dimakan banyak. Sesuai dibawa dalam beg ke pejabat, dicampur dengan kacang dan kismis untuk trail mix sendiri, ditabur atas yogurt, atau dijadikan hiasan atas kek dan pastri.

Mula dengan pek 100 gram untuk cuba, 500 gram bila anda dah tahu ia jadi kegemaran, dan 1kg untuk stok rumah atau kegunaan berniaga. Simpan dalam bekas kedap udara di tempat sejuk dan kering, jauh dari lembapan.$desc$
  where slug = 'kiwi-kering';

-- Kiwi Golden Zespri
update public.products set description = $desc$Kalau anda rasa kiwi hijau terlalu masam, versi keemasan ini jawapannya. Isinya kuning keemasan, jauh lebih manis, kurang masam dan teksturnya lebih lembut serta licin di lidah.

Zespri SunGold datang dari New Zealand dengan kulit lebih licin dan hujung yang tirus. Kerana manisnya menyerlah, ia sesuai untuk anak-anak yang cerewet dengan buah masam, dijadikan pencuci mulut ringan, atau dihiris atas yogurt dan aiskrim.

Pada RM24.90 sepek, ia sedikit lebih tinggi harganya berbanding kiwi hijau dan memang berbaloi untuk rasa yang lebih manis. Simpan dalam peti sejuk selepas ia cukup lembut bila ditekan perlahan.$desc$
  where slug = 'kiwi-zespri-gold';

-- Kurma Libya Gred 1
update public.products set description = $desc$Gred tertinggi bagi kurma Libya — bijinya dipilih pada saiz yang lebih besar dan rupa yang lebih seragam berbanding gred bawah. Isinya lembut dengan manis yang sederhana dan bersih, mudah dimakan berterusan tanpa rasa memberat.

Sebagai kurma harian, ia pilihan seimbang: cukup cantik untuk dihidang kepada tetamu, tetapi masih berpatutan untuk disimpan sebagai stok tetap di rumah. Sesuai juga untuk hidangan berbuka, majlis kecil, atau agihan kepada jemaah.

Pek 500g sesuai untuk mencuba dan kegunaan mingguan, 1kg dan 2kg untuk keluarga, manakala 5kg lebih berbaloi bila anda perlu kuantiti besar. Simpan dalam bekas kedap udara di tempat sejuk dan gelap supaya isinya kekal lembap.$desc$
  where slug = 'kurma-libya-gred-1';

-- Kurma Muda Kuning
update public.products set description = $desc$Ini bukan kurma lembut yang biasa anda makan waktu berbuka. Kurma pada peringkat muda ini berwarna kuning cerah dan rangup seperti epal bila digigit, dengan manis yang ringan serta sedikit rasa kelat yang menyegarkan.

Kerana teksturnya renyah, ia sedap dimakan begitu sahaja sebagai snek, dihidang bersama air sejuk, atau dijadikan buah meja waktu majlis. Ramai juga suka hidangkan bersama kurma masak supaya tetamu dapat rasa dua tekstur berbeza dalam satu pinggan.

Bermula RM12.90, dengan pilihan 500g untuk cuba, 1kg untuk keluarga, dan 2kg kalau nak kongsi ramai-ramai. Simpan dalam bekas tertutup di peti sejuk supaya warnanya kekal cerah dan teksturnya tidak lembik.$desc$
  where slug = 'kurma-muda-kuning';

-- Kurma Sejuk Beku
update public.products set description = $desc$Disimpan dalam keadaan beku sejak awal, kurma ini mengekalkan kelembapan asalnya jauh lebih baik berbanding kurma yang dibiarkan pada suhu bilik. Hasilnya isi yang kekal lembut dan gebu, dengan rasa manis segar yang tidak mengeras walaupun disimpan lama.

Cara terbaik menikmatinya ialah keluarkan sedikit sahaja mengikut keperluan dan biarkan seketika sebelum dimakan, atau terus makan sejuk sebagai pencuci mulut. Ia juga pilihan praktikal untuk anda yang membeli dalam kuantiti besar tetapi tidak mahu risau kualiti menurun.

Pek 500g sesuai kalau ruang peti sejuk beku terhad, 1kg untuk kegunaan keluarga, manakala 10kg sesuai untuk majlis, kafe atau peniaga. Simpan beku sepanjang masa dan elak cair berulang kali.$desc$
  where slug = 'kurma-sejuk-beku';

-- Kurma Tunisia
update public.products set description = $desc$Kurma dari Tunisia ini datang daripada kultivar Deglet Noor yang terkenal — warnanya coklat keemasan cerah, bentuknya langsing dan isinya lebih pejal dengan manis yang bersih serta halus. Tidak selembik kurma hitam, jadi ia pilihan bagus untuk anda yang tidak suka tekstur terlalu lembut.

Rasa manisnya yang sederhana menjadikannya serasi dengan kopi, teh, atau dicincang ke dalam kek, biskut dan bubur. Ia juga popular sebagai kurma hidangan harian kerana bijinya bersih dan tidak melekit di tangan.

Pek 100g dan 300g sesuai untuk mencuba, 500g dan 1kg untuk simpanan rumah, manakala 2kg, 5kg dan karton lebih berbaloi untuk majlis atau jualan semula. Simpan dalam bekas kedap udara di tempat sejuk dan kering.$desc$
  where slug = 'kurma-tunisia';

-- Langsat Johor
update public.products set description = $desc$Langsat manis dari Johor, musim sekali setahun.$desc$
  where slug = 'langsat-johor';

-- Lemon
update public.products set description = $desc$Buah masam serba guna yang patut ada dalam peti sejuk setiap rumah. Kulitnya kuning cerah, airnya masam tajam dan wangi, sesuai untuk apa sahaja yang perlukan sentuhan segar.

Perah untuk air lemon suam waktu pagi, campur dalam air detox bersama pudina, picit atas ikan bakar dan sup, atau parut kulitnya untuk perisa kek dan biskut. Hirisan nipisnya juga cantik dijadikan hiasan minuman bila ada tetamu.

Harga RM1.50 sebiji. Ambil sebiji kalau perlu untuk masakan hari ini, atau set 5 biji kalau anda memang minum air lemon setiap hari. Simpan dalam peti sejuk supaya kulitnya tidak kering dan airnya kekal banyak.$desc$
  where slug = 'lemon';

-- Libya Fresh Gred 2 (Sweet)
update public.products set description = $desc$Kurma segar dari Libya ini dipetik pada peringkat muda dan dijual dalam keadaan masih lembap, jauh berbeza daripada kurma kering yang biasa anda jumpa di rak. Gred 2 ialah pilihan Sweet — kandungan gulanya sudah terbentuk penuh, jadi rasanya lebih manis dan isinya lebih lembut serta berair.

Kerana keadaannya yang segar, ia paling sedap dimakan sejuk terus dari peti dan menjadi hidangan istimewa waktu musim, terutama untuk tetamu yang belum pernah merasa kurma dalam bentuk begini.

Pek 1kg sesuai untuk cuba dan kegunaan keluarga, manakala 2kg dan 5kg untuk majlis atau anda yang memang menunggu musimnya. Simpan sejuk sepanjang masa dan kendalikan dengan lembut kerana isinya mudah lecek.$desc$
  where slug = 'libya-fresh-gred-2';

-- Libya Fresh Gred 3 (Semi Dry)
update public.products set description = $desc$Pilihan separuh kering daripada kurma Libya segar. Berbanding gred Sweet yang lebih lembap dan manis pekat, gred Semi Dry ini sudah kehilangan sebahagian air, jadi teksturnya lebih pejal, lebih mudah dipegang dan rasa manisnya lebih sederhana.

Kerana kandungan lembapannya lebih rendah, ia lebih senang dikendalikan dan tidak selecek kurma segar penuh — pilihan bagus kalau anda mahu merasa kurma Libya buat kali pertama, atau mahu kuantiti yang lebih berpatutan untuk dikongsi ramai.

Ambil pek 1kg untuk kegunaan rumah, 2kg dan 5kg untuk majlis atau agihan. Simpan dalam bekas tertutup di tempat sejuk, dan masukkan ke peti sejuk bila cuaca panas supaya teksturnya kekal stabil.$desc$
  where slug = 'libya-fresh-gred-3';

-- Longan Jumbo
update public.products set description = $desc$Mata kucing bersaiz jumbo — jauh lebih besar daripada longan biasa yang anda selalu jumpa. Kulit coklat nipis mudah dikupas dengan ibu jari, isinya putih jernih dan berair, dengan manis wangi yang khas.

Kelebihan gred jumbo ialah isi lebih tebal, jadi setiap biji terasa berisi dan tidak habis dalam satu gigitan kecil. Paling sedap dimakan sejuk sebagai snek petang, dicampur ke dalam air kosong berais, atau ditambah ke dalam bubur cha cha dan cendol.

Pek 500g cukup untuk snek sendiri, 1kg untuk dikongsi sekeluarga, dan 2kg bila ada tetamu atau majlis kecil. Simpan dalam peti sejuk di dalam bekas bertutup supaya kulitnya tidak kering. Harga RM10.90 sekilogram.$desc$
  where slug = 'longan-jumbo';

-- MABROOM
update public.products set description = $desc$Antara kurma Madinah yang paling mudah dikenali dari rupanya — bentuknya panjang, langsing dan berkedut rapat sepanjang kulit. Teksturnya pula berbeza daripada kurma lembut biasa: lebih kenyal dan sedikit liat, memberi pengalaman mengunyah yang lebih lama dengan manis yang perlahan-lahan keluar.

Kerana teksturnya itu, Mabroom sering jadi kegemaran mereka yang bosan dengan kurma yang terlalu lembik. Sedap dimakan begitu sahaja bersama kopi pahit, atau dihidang kepada tetamu yang gemar mencuba jenis kurma berbeza.

Pek 500g sesuai untuk kegunaan rumah, 1kg untuk peminat setia, dan 5kg atau karton untuk majlis serta jualan semula. Simpan dalam bekas kedap udara di tempat sejuk dan gelap.$desc$
  where slug = 'mabroom';

-- Oren Mandarin
update public.products set description = $desc$Inilah oren yang paling senang dimakan — kulitnya boleh dikupas dengan jari dalam beberapa saat, tanpa pisau dan tanpa tangan melekit. Isinya manis dengan asid yang rendah, jadi tidak mencucuk tekak.

Saiznya kecil hingga sederhana, sesuai dimasukkan dalam beg, diletak atas meja pejabat, atau dibawa sebagai bekal sekolah. Ulasnya senang diasingkan, jadi mudah dikongsi ramai-ramai semasa berkumpul di rumah.

Dijual ikut kilogram pada RM12.90, dan satu kilo sudah cukup untuk beberapa hari snek di rumah. Simpan di tempat sejuk berudara, atau dalam peti sejuk kalau anda suka makan dalam keadaan sejuk. Elak simpan dalam plastik tertutup supaya kulitnya tidak berpeluh.$desc$
  where slug = 'mandarin-l';

-- Mangga Chokanan
update public.products set description = $desc$Mangga Thai berwarna kuning keemasan ini antara yang paling mudah disukai — manisnya tinggi, isinya lembut tanpa serabut, dan tiada rasa masam mengganggu bila betul-betul masak.

Kupas dan hiris terus, atau potong gaya sarang lebah untuk anak-anak. Sesuai juga dijadikan smoothie, puding mangga, topping pulut, atau hirisan sejuk selepas makan tengah hari. Kerana tiada serabut tersangkut di gigi, ia mesra untuk semua peringkat umur.

Dijual ikut kilogram pada RM9.90, harga yang berbaloi kalau anda nak makan mangga selalu tanpa fikir panjang. Buah yang masih keras biarkan di suhu bilik sehingga wangi, kemudian simpan dalam peti sejuk untuk dimakan sejuk.$desc$
  where slug = 'mangga-chokanan';

-- Mangga Kimling
update public.products set description = $desc$Mangga tempatan yang boleh dinikmati dua cara. Ketika muda dan hijau, isinya rangup dan masam segar — inilah sebabnya Kimling jadi pilihan untuk rojak buah, jeruk, dan cicah kicap cili. Biarkan ia masak, rasanya bertukar manis dengan isi yang lebih lembut.

Sebab itu ramai membeli sekali gus dan makan berperingkat: sebahagian dimakan awal ketika masih hijau, sebahagian lagi dibiarkan matang.

Pek 1kg sesuai kalau anda mahu cuba atau buat rojak untuk beberapa orang; 2kg lebih baik untuk membuat jeruk atau bekalan dapur. Simpan mangga hijau di suhu bilik supaya ia matang, kemudian pindahkan ke peti sejuk selepas cukup masak. Harga RM7.90 sekilogram.$desc$
  where slug = 'mangga-kimling';

-- Manggis
update public.products set description = $desc$Digelar ratu buah, dan sekali cuba anda akan faham kenapa. Kulit ungu yang tebal membuka kepada ulas putih bersih, lembut, dengan rasa manis masam halus yang menyegarkan — jenis buah yang cepat habis tanpa disedari.

Cara paling mudah ialah tekan kulitnya sekeliling sehingga terbelah, kemudian cungkil ulas dengan jari. Sedap dimakan terus sejuk, dijadikan pencuci mulut selepas makan berat, atau dicampur dalam salad buah.

Pek 1kg sesuai untuk dinikmati bersama keluarga, manakala 2kg berbaloi ketika musim kerana manggis memang buah bermusim. Simpan dalam peti sejuk dan elak menindih supaya kulitnya tidak mengeras. Harga RM8.90 sekilogram.$desc$
  where slug = 'manggis';

-- MARIAMI A
update public.products set description = $desc$Kurma Mariami dikenali dengan isinya yang lembut, kulit nipis dan rasa manis mesra yang menjadikannya pilihan harian ramai keluarga Malaysia. Warnanya coklat kehitaman dengan bentuk memanjang dan tekstur yang mudah dikunyah.

Gred A ialah tahap asas dalam susunan gred Mariami, diikuti AA dan kemudian AAA yang paling besar. Bermakna gred ini memberi biji bersaiz paling sederhana antara ketiga-tiganya — pilihan tepat kalau anda utamakan rasa dan kekerapan makan berbanding saiz.

Sesuai untuk bekal, juadah berbuka, atau dijadikan bahan smoothie dan kuih. Pek 300g dan 500g untuk rumah, 1kg ke atas hingga karton untuk bekalan besar. Simpan dalam bekas tertutup di tempat sejuk.$desc$
  where slug = 'mariami-a';

-- Mariami AA
update public.products set description = $desc$Berada di tengah susunan gred Mariami, AA memberi biji yang lebih besar dan berisi berbanding gred A, tetapi belum sebesar AAA. Isinya tetap lembut dengan manis yang seimbang, mudah dimakan sesiapa sahaja termasuk kanak-kanak.

Ramai memilih tahap ini kerana ia titik pertengahan yang selesa — saiz sudah nampak cantik bila dihidang, tetapi harga masih mesra untuk dibeli kerap. Sesuai untuk hidangan tetamu biasa, bekalan pejabat, atau stok tetap sepanjang bulan puasa.

Ambil 500g untuk kegunaan rumah, 1kg dan 2kg untuk keluarga yang kerap makan kurma, dan 5kg atau karton untuk agihan. Simpan dalam bekas kedap udara; masukkan ke peti sejuk bila cuaca panas supaya kekal lembap.$desc$
  where slug = 'mariami-aa';

-- Mariami AAA
update public.products set description = $desc$Tahap tertinggi dalam susunan gred Mariami — selepas A dan AA, AAA ialah yang paling besar dan paling seragam bentuknya. Bijinya berisi penuh dengan kulit nipis berkilat dan isi lembut yang terasa lebih mewah setiap kali disuap.

Kerana rupanya kemas dan saiznya menyerlah, gred ini sesuai bila kurma akan dilihat orang: hidangan majlis, dulang tetamu, bingkisan kepada keluarga, atau hadiah ringkas kepada jiran dan rakan.

Pek 300g dan 500g sesuai sebagai buah tangan, manakala 2kg, 5kg dan karton lebih berbaloi untuk penganjur majlis dan peniaga. Simpan dalam bekas kedap udara di tempat sejuk dan gelap supaya isinya tidak mengeras.$desc$
  where slug = 'mariami-aaa';

-- MARIAMI Premium (Kotak)
update public.products set description = $desc$Pilihan Mariami yang dikemas dalam kotak persembahan, sedia untuk diberi tanpa perlu dibungkus semula. Isinya kurma lembut berkulit nipis dengan manis mesra yang mudah diterima semua peringkat umur — sebab itu ia hadiah yang jarang ditolak.

Berbanding pek biasa yang lebih sesuai untuk simpanan dapur, kotak ini dibuat untuk tujuan memberi: hadiah raya, buah tangan ziarah, cenderahati majlis, atau bingkisan kepada pelanggan dan rakan pejabat. Saiz 250g sesuai bila anda perlu banyak bingkisan kecil, manakala 500g memberi kesan lebih bermakna sebagai hadiah utama.

Simpan di tempat sejuk dan kering, elak cahaya matahari terus supaya tekstur kurma kekal lembut.$desc$
  where slug = 'mariami-premium-kotak';

-- MEDJOUL Palestine Jumbo
update public.products set description = $desc$Satu tingkat lebih besar daripada saiz Large, Medjoul Jumbo dari Palestin memberi biji yang lebih panjang dan berat dengan isi tebal serta manis karamel yang lebih pekat terasa. Setiap biji hampir cukup sebagai snek tunggal.

Saiz ini pilihan biasa bila kurma bukan sekadar untuk dimakan sendiri — ia nampak menyerlah dalam dulang tetamu, sesuai untuk jamuan, hidangan berbuka bersama, atau hadiah kepada peminat Medjoul yang tahu membezakan saiz.

Pek 100g sesuai untuk merasa, 500g dan 1kg untuk simpanan rumah, manakala 2kg dan 5kg lebih berbaloi untuk majlis atau jualan semula. Simpan dalam bekas kedap udara di dalam peti sejuk, dan keluarkan sebentar sebelum makan supaya isinya kembali lembut.$desc$
  where slug = 'medjoul-palestine-jumbo';

-- MEDJOUL Palestine Large
update public.products set description = $desc$Digelar raja kurma, Medjoul dikenali dengan isinya yang tebal, lembap dan rasa seakan karamel dengan sedikit nota gula perang. Yang ini datang dari Palestin, dengan kulit berkedut halus dan isi yang terasa penuh di mulut.

Saiz Large ialah pintu masuk kepada dunia Medjoul — sudah pun jauh lebih besar daripada kurma biasa, tetapi paling berpatutan antara tiga saiz yang ada. Sesuai kalau anda mahu menikmati Medjoul dengan kerap tanpa membebankan bajet.

Sedap dimakan begitu sahaja, dibelah dan diisi kacang, atau dihiris ke atas oat dan salad. Pek 100g untuk mencuba, 500g dan 1kg untuk rumah, 2kg dan 5kg untuk majlis. Simpan dalam peti sejuk supaya isinya kekal lembap.$desc$
  where slug = 'medjoul-palestine-large';

-- MEDJOUL Palestine Super Jumbo
update public.products set description = $desc$Pilihan Medjoul paling besar yang ada — biji disaring pada saiz maksimum, berat di tangan dengan isi yang sangat tebal dan rasa karamel yang paling ketara antara ketiga-tiga saiz. Inilah rupa Medjoul yang sering dilihat dalam bingkisan mewah.

Kerana saiz dan penampilannya, ia paling sesuai sebagai hadiah, hantaran, atau hidangan untuk tetamu istimewa apabila anda mahu kurma yang bercakap sendiri tanpa perlu apa-apa hiasan tambahan.

Ambil pek 100g kalau sekadar mahu merasa perbezaannya, 500g sebagai buah tangan, dan 1kg hingga 5kg untuk majlis atau peminat setia. Simpan di dalam peti sejuk dalam bekas tertutup, dan biarkan di suhu bilik seketika sebelum dihidang.$desc$
  where slug = 'medjoul-palestine-super-jumbo';

-- Mini Red Plum
update public.products set description = $desc$Saiznya kecil muat dalam genggaman, warnanya merah menyala, dan rasanya datang berlapis — kulitnya masam menyegarkan, isinya pula manis dan berair. Kombinasi masam manis inilah yang buat orang susah berhenti pada satu biji sahaja.

Makan terus bersama kulit selepas dibasuh, tak perlu kupas. Sesuai jadi snek petang, bekal pejabat, atau buah meja untuk tetamu kerana bentuknya cantik dan senang dicapai. Boleh juga dihiris masuk salad buah untuk tambah rasa masam.

Satu pack berharga RM12.90. Simpan dalam peti sejuk supaya kulitnya kekal tegang dan isinya padat; plum yang dibiar lama di suhu bilik akan cepat menjadi lembut.$desc$
  where slug = 'mini-red-plum';

-- Mini Sweet Orange
update public.products set description = $desc$Oren bersaiz kecil yang manis dan senang dihabiskan dalam satu duduk. Saiznya yang comel menjadikannya snek sempurna — tak perlu potong, tak perlu pinggan, cukup kupas dan makan.

Sesuai dimasukkan dalam kotak bekal anak, disimpan dalam laci meja pejabat, atau dibawa masa jalan-jalan. Manisnya mesra kanak-kanak yang biasanya tak suka oren masam. Boleh juga dihiris dalam salad atau jadi hiasan pinggan pencuci mulut.

Bermula RM9 sepek. Pilih 500g kalau nak cuba dahulu, 1kg untuk stok mingguan rumah, dan 2kg kalau ramai orang di rumah atau nak kongsi di pejabat. Simpan di tempat sejuk berudara, atau dalam peti sejuk kalau suka makan sejuk.$desc$
  where slug = 'mini-sweet-orange';

-- Nanas MD2
update public.products set description = $desc$Kultivar nanas gold yang mengubah tanggapan ramai orang tentang nanas. Isinya kuning keemasan, manis tinggi dengan asid yang rendah, jadi lidah tidak mudah menggatal seperti bila makan nanas biasa. Teksturnya padat tetapi tetap berair.

Sesuai dipotong bulat sebagai pencuci mulut, dikisar jadi jus segar, dicampur dalam salad, atau dibakar sebentar sebagai teman ayam dan daging panggang. Manisnya cukup untuk dimakan terus tanpa perlu ditabur garam.

Dijual sebiji pada harga RM11.90, saiz yang munasabah untuk satu keluarga habiskan dalam satu hidangan. Simpan di suhu bilik sebelum dipotong, dan masukkan ke dalam bekas bertutup di peti sejuk selepas dikupas.$desc$
  where slug = 'nanas-morris';

-- Navel Orange [12-14pcs]
update public.products set description = $desc$Oren bersaiz besar dengan isi tanpa biji — jenis ini memang untuk dimakan terus, bukan diperah. Kulitnya senang dikupas, ulasnya besar dan padat, dan manisnya penuh tanpa masam yang menyakitkan tekak.

Kupas dan makan ulas demi ulas, atau hiris bulat untuk hidangan pencuci mulut yang nampak menarik atas pinggan. Kerana tiada biji, ia lebih senang dan selamat untuk kanak-kanak serta warga emas.

Ada dua pilihan pek: 6 biji untuk kegunaan rumah biasa, dan pek 12 hingga 14 biji pada RM23.90 kalau nak stok lebih lama atau jadikan buah tangan. Simpan di tempat sejuk berudara, atau dalam peti sejuk kalau anda suka makan dalam keadaan sejuk.$desc$
  where slug = 'navel-orange-';

-- Packham Pear China
update public.products set description = $desc$Bentuknya tidak sekata dan sedikit berbonggol — itu memang ciri Packham, bukan kecacatan. Kulit hijaunya akan bertukar lebih cerah apabila matang, dan ketika itulah isinya menjadi lembut, berair, serta sangat manis.

Kerana teksturnya lembut bila masak, ia sesuai untuk warga emas, kanak-kanak kecil, atau sesiapa yang kurang gemar buah terlalu keras. Boleh dimakan terus dengan sudu, dikisar jadi jus, atau dimasak sebagai pencuci mulut.

Harga RM9 sebiji. Ambil 3 biji untuk cubaan, 5 biji untuk keluarga, dan 10 biji kalau anda memang membekalkan buah setiap minggu. Biarkan di suhu bilik sehingga sedikit lembut bila ditekan, kemudian simpan dalam peti sejuk.$desc$
  where slug = 'packham-pear-china';

-- Pakej Harian B
update public.products set description = $desc$Epal + Oren + Pisang + Betik. Bekalan buah 3-4 hari.$desc$
  where slug = 'pakej-harian-b';

-- Pakej Keluarga A
update public.products set description = $desc$Mangga + Betik + Nanas + Rambutan. Cukup untuk 4-5 orang.$desc$
  where slug = 'pakej-keluarga-a';

-- Pakej Premium Import
update public.products set description = $desc$Strawberry + Anggur + Kiwi. Hadiah atau majlis istimewa.$desc$
  where slug = 'pakej-premium-import';

-- Gula-gula Kacang (Peanut Candy)
update public.products set description = $desc$Manisan lama yang masih ramai cari, kacang tanah disatukan dengan gula sehingga menjadi kepingan yang rangup dan manis.

Sekali gigit, lapisan gula pecah dan rasa kacang tanah terus naik. Ia teman yang bagus untuk kopi atau teh petang, buah tangan untuk orang tua yang rindukan rasa zaman dulu, dan isi balang masa rumah terbuka.

Pek 100g senang diselit dalam beg atau kotak bekal. Pek 400g sesuai jadi stok di rumah, manakala 800g berbaloi kalau anda nak hidang kepada ramai atau bahagikan kepada jiran dan saudara.

Kerana ia manisan rangup, tutup rapat selepas dibuka dan simpan di tempat kering. Kelembapan akan buat teksturnya melembut. Harga RM12 sepek.$desc$
  where slug = 'peanut-candy';

-- Pistachio
update public.products set description = $desc$Snek yang sengaja lambat, itulah kelebihan pistasio. Kulitnya terbelah sedikit di hujung, jadi anda perlu kupas satu per satu sebelum makan, dan sebab itulah ia sesuai menemani perbualan panjang atau malam menonton siri kegemaran.

Isinya hijau dengan rasa berkacang yang halus dan tidak melebih, jadi anda tidak cepat jemu. Boleh juga dikupas dan dicincang untuk hiasan atas kek, puding atau kuih.

Pek 100g cukup untuk seorang menghabiskan satu filem. Pek 500g sesuai dikongsi sekeluarga, manakala 1kg untuk musim kenduri, rumah terbuka atau bila anda mahu isi beberapa balang sekali gus.

Simpan dalam bekas kedap udara di tempat sejuk dan kering. Harga RM15 sepek.$desc$
  where slug = 'pistachio';

-- Pulasan
update public.products set description = $desc$Saudara rapat rambutan, tetapi ramai yang kata rasanya lebih sedap. Kulitnya merah gelap dengan bintil pendek dan tebal, bukan rambut panjang, jadi lebih mudah dipegang dan dibelah dengan tangan.

Isinya putih dan lebih manis daripada rambutan, dan yang paling penting — senang tanggal dari biji, jadi tidak melekat atau berhabuk ketika dimakan. Sesuai untuk snek petang, hidangan tetamu, atau sekadar dimakan sejuk sambil berehat.

Ini buah bermusim yang tidak sentiasa ada di pasaran, jadi ambil peluang ketika ia keluar. Simpan dalam peti sejuk di dalam beg berlubang supaya kulitnya kekal segar dan tidak kering. Harga RM9.90 sekilogram.$desc$
  where slug = 'pulasan';

-- Rambutan Anak Sekolah 
update public.products set description = $desc$Antara kultivar rambutan paling popular di Malaysia, dan bukan tanpa sebab. Isinya manis, dan yang buat orang jatuh hati — isi mudah terpisah daripada biji, tidak melekat seperti rambutan jenis lain. Makan pun jadi bersih dan tidak menyusahkan.

Kulit merah dengan rambut yang masih segar menandakan buah baru dipetik. Paling sedap dimakan sejuk terus dari peti sebagai snek keluarga, atau dihidang ketika kenduri dan rumah terbuka.

Pek 1KG sesuai untuk makan sendiri atau berdua, manakala 2KG lebih sesuai untuk keluarga besar kerana rambutan memang cepat habis. Simpan dalam peti sejuk dan jangan biarkan lama di luar supaya rambutnya tidak kering. Harga RM11.90 sekilogram.$desc$
  where slug = 'rambutan-anak-sekolah';

-- Red Apple New Zealand 5biji/pack
update public.products set description = $desc$Epal merah dari New Zealand yang dikenali dengan kualiti yang konsisten. Kulitnya merah menyala, isinya rangup dan berair, dengan rasa manis segar yang sesuai dimakan bila-bila masa.

Inilah jenis epal serba guna: bawa ke pejabat, letak dalam bekal anak, hiris untuk salad, atau simpan sebagai buah sedia ada di dapur untuk sesiapa yang lapar tengah hari.

Dijual bermula RM12.90 sepek. Pilih 3 biji kalau sekadar mahu mencuba, 5 biji untuk keluarga kecil, dan 10 biji kalau anda mahukan bekalan penuh seminggu tanpa perlu order berulang kali. Simpan dalam peti sejuk supaya teksturnya kekal rangup dan jangan simpan bersama buah yang cepat masak.$desc$
  where slug = 'red-apple-new-zealand';

-- Roasted Cashew
update public.products set description = $desc$Kalau anda cari kacang yang lebih lembut di gigi, gajus panggang inilah jawapannya. Teksturnya berkrim dan rasanya manis semula jadi, tidak sekeras badam, jadi senang dimakan orang tua dan kanak-kanak.

Sesuai dihidang bila tetamu datang, masa majlis kecil, atau sekadar diletak dalam balang atas meja ruang tamu. Ramai juga campurkan dalam nasi goreng, kari atau tumisan untuk tambah isi dan gigitan.

Ambil pek 100g untuk rasa dahulu, 500g untuk simpanan rumah, dan 1kg kalau anda kerap sediakan buah tangan atau isi balang musim perayaan.

Tutup rapat selepas dibuka dan letak di tempat kering supaya ia tidak melempem. Harga RM15 sepek.$desc$
  where slug = 'roasted-cashew';

-- ROTAB
update public.products set description = $desc$Berbeza dengan kurma kering yang biasa dijual di rak, Rotab ialah kurma pada peringkat separuh masak — masih lembap, gebu dan segar. Isinya lembut sehingga hampir cair di mulut dengan manis semula jadi yang bersih dan tidak melekit.

Oleh sebab kandungan lembapannya tinggi, Rotab lazimnya disimpan sejuk atau sejuk beku dan dikeluarkan sedikit demi sedikit sebelum dihidang. Dimakan sejuk, ia terasa seperti pencuci mulut ringan — pilihan menarik untuk berbuka, hidangan selepas makan malam, atau untuk tetamu yang belum pernah merasa kurma dalam keadaan begini.

Kendalikan dengan lembut kerana isinya mudah lecek, dan elak keluar masuk peti berulang kali supaya teksturnya kekal cantik.$desc$
  where slug = 'rotab';

-- ROTAB SUKKARI
update public.products set description = $desc$Rotab bermaksud peringkat kurma yang belum kering sepenuhnya — masih lembap, segar dan gebu. Versi Sukkari ini mengekalkan warna keemasan dan manis pekatnya, tetapi teksturnya jauh lebih lembut dan berair berbanding Sukkari kering.

Kerana kandungan lembapannya tinggi, ia lazimnya disimpan sejuk beku dan dikeluarkan sedikit demi sedikit sebelum dimakan. Dimakan sejuk terus dari peti, teksturnya terasa seperti pencuci mulut — sebab itu ramai yang suka menghidangkannya waktu berbuka atau selepas makan malam.

Pilih pek 100g atau 500g kalau ruang peti sejuk beku terhad, dan 1kg hingga karton kalau anda memang mahu simpan stok. Elak keluar masuk peti berulang kali supaya teksturnya kekal cantik.$desc$
  where slug = 'rotab-sukkari';

-- SAFAWI Jumbo
update public.products set description = $desc$Gred paling besar dalam pilihan Safawi biasa, memberi biji panjang berisi dengan permukaan berkilat dan isi yang tebal. Rasa manis karamelnya terasa lebih penuh kerana setiap biji mengandungi lebih banyak isi.

Saiz besar begini nampak menyerlah bila disusun dalam dulang, jadi ramai memilihnya untuk majlis, jamuan pejabat dan hidangan tetamu penting. Ia juga pilihan bagi peminat Safawi yang memang tidak berkenan biji kecil.

Pek 300g dan 500g sesuai sebagai buah tangan, manakala 2kg dan 5kg lebih berbaloi untuk penganjur majlis atau bekalan jangka panjang. Simpan dalam bekas kedap udara di tempat sejuk dan gelap, dan biarkan sebentar di suhu bilik sebelum dihidang.$desc$
  where slug = 'safawi-jumbo';

-- SAFAWI Jumbo Premium (Kotak)
update public.products set description = $desc$Kurma Safawi bersaiz jumbo yang dimuatkan dalam kotak persembahan siap untuk dihadiahkan. Biji panjang berkilat disusun kemas, memberi kesan pertama yang menarik sebaik kotak dibuka.

Bezanya dengan pek biasa bukan sekadar isi, tetapi kesediaan untuk diberi — tidak perlu bungkus semula, terus boleh dihulur sebagai hadiah raya, buah tangan ziarah, cenderahati majlis atau bingkisan untuk pelanggan. Kotak 250g sesuai bila anda perlu beberapa bingkisan kecil, manakala 500g lebih sesuai untuk hadiah utama.

Simpan di tempat sejuk dan kering, jauh daripada cahaya matahari terus, supaya isi kurma kekal lembut dan kotak kekal kemas sehingga diserahkan.$desc$
  where slug = 'safawi-jumbo-premium-kotak';

-- SAFAWI Large
update public.products set description = $desc$Untuk anda yang mahu biji lebih panjang dan berisi, gred Large memberi Safawi bersaiz lebih besar daripada Medium tanpa lompat harga yang tinggi. Isinya tebal, lembut, dengan manis sederhana yang mudah dimakan berulang kali.

Saiz ini sesuai bila kurma bukan sekadar untuk diri sendiri — hidangkan kepada tetamu yang datang, bawa ke rumah keluarga, atau letak dalam bekas di ruang tamu sepanjang bulan puasa. Ia titik seimbang antara penampilan dan harga.

Pek 500g sesuai untuk simpanan rumah, 1kg dan 2kg untuk keluarga yang kerap makan kurma, dan 5kg untuk jamuan atau agihan. Simpan dalam bekas tertutup di tempat sejuk; peti sejuk membantu mengekalkan kelembutan bila cuaca panas.$desc$
  where slug = 'safawi-large';

-- SAFAWI Medium
update public.products set description = $desc$Berasal dari Madinah, Safawi dikenali dengan bentuk hitam memanjang, kulit berkilat dan isi lembut dengan manis yang sederhana serta sedikit rasa karamel. Ia antara kurma paling mudah diterima ramai kerana tidak terlalu memberat di tekak.

Gred Medium ialah saiz asas — cukup untuk sekali suap dan paling menjimatkan dalam keluarga Safawi. Sesuai untuk makan harian, hidangan pantas waktu petang, atau simpanan tetap di dapur dan pejabat.

Pek 100g bagus untuk mencuba dahulu, 300g dan 500g untuk kegunaan mingguan, manakala 1kg hingga 5kg lebih berbaloi bila anda beli untuk keluarga besar atau kegunaan surau. Simpan dalam bekas kedap udara supaya isinya kekal lembap.$desc$
  where slug = 'safawi-medium';

-- Serunding Ayam
update public.products set description = $desc$Isi ayam disuwir halus, dimasak perlahan bersama rempah dan kelapa sehingga kering dan gebu. Rasanya lebih ringan dan wangi berbanding versi daging, jadi anak-anak pun selalunya boleh terima.

Cara paling klasik ialah dimakan bersama ketupat, lemang atau nasi impit masa raya. Hari biasa pula ia sedap dengan nasi panas, disapu dalam roti, atau dijadikan inti sandwic dan wrap untuk bekal sekolah.

Oleh sebab ia kering, serunding tidak perlu disimpan dalam peti sejuk. Cukup masukkan dalam bekas tertutup rapat dan letak di tempat kering, elak terkena air atau sudu basah.

Pek 200g sesuai untuk cuba, 400g untuk keluarga kecil, manakala 800g dan 1kg lebih berbaloi masa musim perayaan. Harga RM27 sepek.$desc$
  where slug = 'serunding-ayam';

-- Serunding Daging
update public.products set description = $desc$Lebih pekat dan lebih berani, itulah bezanya serunding daging. Daging disuwir halus dan dimasak bersama rempah serta kelapa sehingga kering, meninggalkan rasa yang lebih dalam berbanding serunding ayam.

Ia pilihan biasa untuk hidangan raya bersama ketupat, lemang dan nasi impit. Peminat tegar pula makan terus dengan nasi putih panas, atau menaburkannya atas bubur dan lontong untuk tambah rasa.

Teksturnya yang kering menjadikan ia mudah disimpan tanpa peti sejuk. Masukkan dalam bekas kedap udara, letak di tempat kering dan gelap, dan guna sudu kering setiap kali menceduk.

Mula dengan pek 200g kalau baru nak cuba. Pek 400g sesuai untuk rumah, manakala 800g dan 1kg untuk kenduri atau hantaran. Harga RM27 sepek.$desc$
  where slug = 'serunding-daging';

-- Singo Pear
update public.products set description = $desc$Pear Korea yang juga dikenali sebagai Nashi — bulat seperti epal, berkulit keemasan, dan sangat berair. Sekali gigit terus terasa airnya memenuhi mulut, dengan tekstur rangup dan manis yang lembut serta menyegarkan.

Paling sedap dimakan sejuk, dipotong bulat sebagai pencuci mulut, atau dihiris ke dalam salad. Kandungan airnya yang tinggi menjadikan ia pilihan popular ketika cuaca panas atau selepas makan berat.

Harga RM5 sebiji. Beli 1 biji untuk mencuba, 3 biji untuk bekalan beberapa hari, atau 5 biji untuk seisi keluarga. Simpan dalam peti sejuk dan kendalikan dengan lembut kerana kulitnya nipis dan mudah lebam.$desc$
  where slug = 'singo-pear';

-- Strawberry Korea
update public.products set description = $desc$Strawberry besar dari Korea, manis dan segar.$desc$
  where slug = 'strawberry-korea';

-- Strawberry USA (250Gram)
update public.products set description = $desc$Merah menyala, bersaiz besar dan berair, strawberi dari Amerika Syarikat ini memang menyerlah sebaik kotak dibuka. Rasanya manis dengan sedikit masam segar yang buat orang ambil sebiji lagi.

Sedap dimakan terus, dicicah coklat cair, dipotong atas kek, atau dijadikan hiasan pinggan buah. Sebab saiznya besar, satu biji pun dah nampak penuh dalam pinggan.

Setiap pek 250 gram berharga RM21. Ambil 1 pek untuk snek keluarga kecil, 2 pek bila nak buat dessert, dan 3 pek untuk majlis atau bila anda nak simpan sebahagian untuk smoothie. Letak dalam peti sejuk sebaik sampai dan basuh hanya sebelum makan supaya tidak cepat lembik.$desc$
  where slug = 'strawberry-usa';

-- Anggur Sweet Globe
update public.products set description = $desc$Bulat besar, hijau cerah, dan sangat rangup — itulah tanda Sweet Globe. Setiap butir padat berisi dengan air yang banyak dan rasa manis bersih, tanpa biji dan tanpa masam yang tajam. Gigitan pertama memang terasa bunyi rangupnya.

Sesuai untuk sesiapa yang suka anggur hijau tetapi mahukan saiz lebih besar dan tekstur lebih tegas. Cantik dihidang dalam bekas atas meja, mudah dibawa ke pejabat, dan selamat untuk anak kecil kerana tiada biji.

Pek 500g untuk cubaan, 1kg untuk keluarga, dan 2kg untuk majlis atau bekalan sepanjang minggu. Simpan bersama tangkai dalam peti sejuk dan bilas hanya sebelum makan supaya kekal rangup. Bermula RM24.90 sepek.$desc$
  where slug = 'sweet-globe';

-- Sweet Potato Vietnam
update public.products set description = $desc$Ubi keledek dari Vietnam ini biasanya berisi ungu atau oren, dengan manis semula jadi yang keluar sepenuhnya selepas dimasak. Teksturnya padat dan lembut, jenis ubi serba guna untuk dapur harian.

Kukus, rebus, bakar dalam oven atau masuk air fryer sehingga empuk. Sedap dimakan begitu sahaja sebagai pengganti nasi waktu malam, dilenyek jadi bubur untuk anak kecil, dijadikan kuih, atau dipotong wedges untuk snek petang. Isi ungunya juga memberi warna cantik untuk bebola ubi dan kek.

Dijual ikut kilogram pada RM10.90 — 1kg untuk masak sekali dua, 2kg kalau anda memang makan ubi setiap minggu. Simpan di tempat kering, gelap dan berudara; ubi mentah tidak sesuai disimpan dalam peti sejuk.$desc$
  where slug = 'sweet-potato-vietnam';

-- Tangkai Tunisia
update public.products set description = $desc$Kurma Deglet Noor yang dijual masih melekat pada tangkainya, persis rupanya sewaktu dipetik dari pokok. Bentuk persembahan begini sentiasa menarik perhatian — cukup diletak di atas dulang, ia sudah jadi hiasan meja yang cantik tanpa perlu apa-apa tambahan.

Rasanya sama seperti Deglet Noor yang anda kenali: manis bersih, isi pejal dan warna coklat keemasan. Cuma pengalaman memetik satu persatu dari tangkai itulah yang menjadikannya pilihan popular untuk majlis, jamuan terbuka, hantaran dan hadiah bermusim.

Pek 400g dan 500g sudah cukup untuk satu persembahan meja. Simpan dalam pembungkusnya di tempat sejuk dan kering, elak tekanan supaya tangkai tidak patah dan susunannya kekal kemas.$desc$
  where slug = 'tangkai-tunisia';

-- Tembikai Potong
update public.products set description = $desc$Tembikai merah dipotong segar, siap makan.$desc$
  where slug = 'tembikai-potong';

-- Tembikai Seedless
update public.products set description = $desc$Tembikai tanpa biji import, merah dan berair.$desc$
  where slug = 'tembikai-seedless';

-- Ubi Madu Cilembu 500g/pack
update public.products set description = $desc$Ubi keledek dari Cilembu, Jawa Barat, memang lain daripada ubi biasa. Bila dibakar perlahan, gulanya cair keluar menjadi cecair pekat seperti madu di hujung ubi — itulah sebabnya ia digelar ubi madu. Isinya lembut, manis berkaramel, dan hampir tak perlu apa-apa tambahan.

Cara terbaik memang dibakar dalam oven atau air fryer, bukan direbus, kerana rebusan tidak mengeluarkan karamel yang sama. Sesuai jadi snek petang bersama kopi, sarapan yang mengenyangkan, atau juadah berbuka.

Setiap pek 500 gram, berharga RM9.90. Simpan di tempat kering dan berudara, jauh dari cahaya matahari terus, dan elakkan peti sejuk semasa ia masih mentah.$desc$
  where slug = 'ubi-madu-cilembu-500gpack';

-- Valencia Orange 5pcs/pack
update public.products set description = $desc$Kalau niat anda memang nak buat jus, inilah oren yang dicari. Valencia terkenal sebagai oren jus klasik — airnya banyak, rasanya manis dengan sedikit masam yang membuatkan jus terasa hidup dan tidak muak.

Setiap pack mengandungi 5 biji pada harga RM12.90, cukup untuk beberapa gelas jus segar. Perah pagi-pagi untuk sarapan, campur ais untuk minuman petang, atau gabungkan dengan lemon dan pudina bila ada tetamu datang.

Kulitnya lebih melekat berbanding mandarin, jadi ia lebih sesuai dipotong dan diperah daripada dikupas dengan tangan. Simpan dalam peti sejuk supaya airnya kekal banyak, dan gulingkan sedikit atas meja sebelum diperah untuk hasil lebih lumayan.$desc$
  where slug = 'valencia-oren-jus';

-- ── KATEGORI (33) ────────────────────────────────────────────

-- Anggur
update public.categories set description = $desc$Anggur import tanpa biji — Shine Muscat hijau yang wangi dan sangat manis, Sweet Sapphire ungu berbentuk jari, Autumn Royal hitam bujur, Sweet Globe hijau bulat besar, dan Crimson merah yang manis bercampur sedikit masam. Semuanya boleh dimakan terus bersama kulit tanpa perlu buang biji, jadi selamat dan senang untuk kanak-kanak. Disimpan sejuk sepanjang perjalanan supaya butirnya kekal rangup dan tangkainya kekal segar.$desc$
  where slug = 'anggur';

-- Beri & Kiwi
update public.categories set description = $desc$Beri dan kiwi import untuk sarapan, pencuci mulut dan bakeri — strawberi USA bersaiz besar, blueberry manis masam, serta kiwi Zespri dari New Zealand dalam dua pilihan: hijau yang lebih masam bertekstur, dan SunGold keemasan yang jauh lebih manis. Sesuai ditabur atas oat dan yogurt, dijadikan hiasan kek, atau dimakan terus sejuk. Semuanya buah lembut yang dikendalikan sejuk sepanjang perjalanan.$desc$
  where slug = 'beri-kiwi';

-- Bermusim
update public.categories set description = $desc$Buah yang hanya ada pada musimnya — masuk bila kiriman tiba dan habis bila musim berakhir. Inilah tempat untuk cari buah yang tak dijual sepanjang tahun, jadi berbaloi disemak semula dari semasa ke semasa. Tekan butang bagitahu bila ada pada produk yang habis stok supaya anda dimaklumkan sebaik ia masuk semula.$desc$
  where slug = 'bermusim';

-- Buah Import
update public.categories set description = $desc$Buah import dari Turki, Uzbekistan, Sepanyol, China, New Zealand, Kenya dan Vietnam — ceri, aprikot, donut peach, anggur, epal, pear, avocado, melon dan banyak lagi. Semuanya dipilih pada gred yang baik dan disimpan sejuk dari gudang sehingga ke pintu rumah anda. Ini kategori paling luas di SyababFresh, sesuai kalau anda mahu terus lihat semua pilihan import dalam satu tempat.$desc$
  where slug = 'buah-import';

-- Buah Kering
update public.categories set description = $desc$Buah kering tanpa gula tambahan — aprikot kering Turki yang lembut dan kenyal, buah tin yang manis seperti madu dengan biji halus yang rangup, dan hirisan kiwi kering yang manis masam. Sesuai sebagai snek pejabat, campuran oat dan granola, bekalan berbuka, atau bahan bakeri. Simpan dalam bekas kedap udara di tempat sejuk dan kering supaya teksturnya kekal.$desc$
  where slug = 'buah-kering';

-- Buah Kering & Kacang
update public.categories set description = $desc$Semua snek kering dalam satu tempat — buah kering seperti aprikot, tin dan kiwi; kismis hitam, golden dan sultana; serta kacang panggang seperti badam, gajus dan pistachio. Pilihan yang tahan lama tanpa perlu peti sejuk, sesuai untuk isi balang raya, bekalan pejabat, hidangan tetamu, atau bahan membuat kuih dan roti.$desc$
  where slug = 'buah-kering-kacang';

-- Buah Potong
update public.categories set description = $desc$Buah yang sudah dibasuh, dikupas dan dipotong siap untuk dimakan. Sesuai bila anda mahu buah segar tanpa perlu menyiang, seperti untuk bekal, mesyuarat pejabat atau hidangan pantas di rumah.$desc$
  where slug = 'buah-potong';

-- Buah Tempatan
update public.categories set description = $desc$Buah tempatan Malaysia dan rantau ini — manggis, pulasan, rambutan, longan jumbo, jambu batu, buah naga, nanas MD2 dan mangga. Kebanyakannya buah bermusim, jadi pilihan berubah mengikut apa yang sedang keluar. Dipilih pada gred yang baik dan disimpan sejuk supaya sampai dalam keadaan padat, bukan lembik.$desc$
  where slug = 'buah-tempatan';

-- Ceri
update public.categories set description = $desc$Ceri segar dari Turki dan Amerika Syarikat, termasuk gred saiz besar 28mm ke atas. Turki ialah pengeluar ceri terbesar dunia dan ceri dari sana terkenal gelap, berisi dan manis pekat; ceri USA pula masuk pada musim berbeza dengan warna merah gelap dan sedikit masam yang menyegarkan. Ceri buah yang sangat mudah rosak — kami hantar sejuk, dan elak membasuhnya sehingga tiba masa hendak dimakan.$desc$
  where slug = 'ceri';

-- Delima
update public.categories set description = $desc$Buah delima dengan biji merah berkilat yang manis dan berair. Sesuai dimakan terus, ditabur atas salad dan yogurt, atau diperah menjadi jus segar. Ada pilihan beli ikut biji untuk kegunaan rumah, atau ikut karton untuk peniaga jus dan majlis besar.$desc$
  where slug = 'delima';

-- Durian
update public.categories set description = $desc$Durian tempatan mengikut musim. Stok bergantung sepenuhnya pada musim dan kiriman, jadi kategori ini akan kosong di luar musim. Tekan butang bagitahu bila ada pada produk yang habis stok supaya anda dimaklumkan sebaik kiriman baharu masuk.$desc$
  where slug = 'durian';

-- Durian Frozen
update public.categories set description = $desc$Durian sejuk beku yang boleh dinikmati di luar musim. Disimpan beku untuk mengekalkan isi dan aromanya, jadi anda tidak perlu menunggu musim durian untuk merasainya. Simpan dalam peti sejuk beku dan keluarkan sedikit demi sedikit mengikut keperluan.$desc$
  where slug = 'durian-frozen';

-- Epal & Pear
update public.categories set description = $desc$Epal dan pear import — Fuji XL Jepun yang sangat rangup, epal merah New Zealand, pear Korea Singo yang penuh air, Packham hijau yang lembut bila masak, dan Forelle kecil berbintik merah. Buah yang senang dibawa dan tahan agak lama dalam peti sejuk, jadi sesuai jadi stok tetap untuk bekal sekolah dan snek pejabat.$desc$
  where slug = 'epal-pear';

-- Gift Box
update public.categories set description = $desc$Kotak hadiah siap sedia untuk diberi tanpa perlu dibungkus semula. Sesuai untuk hadiah raya, buah tangan ziarah, cenderahati majlis, atau bingkisan korporat kepada pelanggan dan rakan sekerja.$desc$
  where slug = 'gift-box';

-- Gift Box & Set
update public.categories set description = $desc$Set dan kotak hadiah gabungan — himpunan buah atau kurma pilihan dalam satu pembungkusan yang kemas. Pilihan mudah bila anda mahu memberi sesuatu yang nampak lengkap tanpa perlu memilih satu per satu.$desc$
  where slug = 'gift-box-set';

-- Jus & Minuman
update public.categories set description = $desc$Jus dan minuman berasaskan buah, dijual per botol dengan pilihan set untuk kegunaan rumah, pejabat atau majlis. Sesuai sebagai ganti air manis biasa, hidangan berbuka, atau minuman selepas bersenam.$desc$
  where slug = 'jus-minuman';

-- Kacang
update public.categories set description = $desc$Kacang panggang dan manisan kacang — badam rangup, gajus yang lebih lembut dan berkrim, pistachio dalam kulit yang perlu dikupas satu per satu, serta gula-gula kacang tradisional. Sesuai untuk isi balang rumah terbuka, hidangan tetamu, bekal pejabat, atau taburan pada kek dan salad. Simpan dalam bekas tertutup rapat supaya kekal rangup.$desc$
  where slug = 'kacang';

-- Kismis
update public.categories set description = $desc$Kismis dalam empat pilihan — hitam jumbo yang manis pekat, golden yang lebih lembut dan sedikit masam, golden jumbo yang lebih besar dan kenyal, serta sultana tanpa biji yang halus dan manis lembut. Sesuai dicampur dalam roti, kek, bubur, nasi tomato dan kuih, atau dimakan terus sebagai snek.$desc$
  where slug = 'kismis';

-- Kurma
update public.categories set description = $desc$Semua kurma SyababFresh dalam satu tempat — Ajwa dan Safawi dari Madinah, Medjoul dari Palestin, Mariami, Sukkari dari Arab Saudi, Deglet Noor Tunisia, Mabroom, kurma Libya, serta kurma muda dan rotab yang masih lembap. Tersedia dari pek 100g untuk mencuba sehingga karton untuk majlis, surau dan peniaga. Setiap jenis ada gred saiznya sendiri, jadi anda boleh pilih ikut tujuan: makan harian, hidangan tetamu, atau hadiah.$desc$
  where slug = 'kurma';

-- Kurma Ajwa
update public.categories set description = $desc$Kurma Ajwa dari Madinah — hitam kelam, isi lembut, dengan manis halus yang tidak menyengat di tekak. Tersedia dalam gred Medium, Large, Jumbo dan Super Jumbo VIP mengikut saiz biji, serta pilihan Aliyah Mix yang bercampur saiz dan kotak hadiah siap bungkus. Pilih gred kecil untuk makan harian, gred besar untuk hidangan tetamu dan hadiah. Ada dari pek 100g hingga karton.$desc$
  where slug = 'kurma-ajwa';

-- Kurma Lain-lain
update public.categories set description = $desc$Kurma pilihan lain di luar jenis utama — Deglet Noor Tunisia yang langsing dan pejal, Tangkai Tunisia yang masih melekat pada dahan untuk hidangan meja, Mabroom Madinah yang panjang dan kenyal, kurma Libya, Rotab yang lembap, serta kurma sejuk beku. Sesuai kalau anda mahu mencuba sesuatu yang lain daripada Ajwa dan Safawi.$desc$
  where slug = 'kurma-lain-lain';

-- Kurma Mariami
update public.categories set description = $desc$Kurma Mariami — isi lembut, kulit nipis dan manis mesra yang menjadikannya pilihan harian ramai keluarga Malaysia. Digredkan sebagai A, AA dan AAA mengikut saiz, dengan AAA yang paling besar dan paling seragam. Ada juga kotak hadiah siap bungkus. Sesuai untuk bekal, juadah berbuka, atau dijadikan bahan smoothie dan kuih.$desc$
  where slug = 'kurma-mariami';

-- Kurma Medjoul
update public.categories set description = $desc$Kurma Medjoul dari Palestin, sering digelar raja kurma — isinya tebal dan lembap dengan rasa seakan karamel. Ada tiga saiz: Large sebagai pilihan paling berpatutan, Jumbo yang lebih berat, dan Super Jumbo untuk saiz paling besar. Sedap dimakan begitu sahaja, dibelah dan diisi kacang, atau dihiris ke atas oat. Simpan dalam peti sejuk supaya isinya kekal lembap.$desc$
  where slug = 'kurma-medjoul';

-- Kurma Muda & Segar
update public.categories set description = $desc$Kurma pada peringkat muda dan segar, bukan kurma kering yang biasa di rak. Teksturnya masih lembap atau rangup bergantung gred, dengan rasa yang lebih bersih dan segar. Ini pilihan bermusim yang hanya ada ketika kiriman masuk, jadi berbaloi disemak bila musimnya tiba.$desc$
  where slug = 'kurma-muda-segar';

-- Kurma Safawi
update public.categories set description = $desc$Kurma Safawi dari Madinah — bentuk hitam memanjang dengan kulit berkilat, isi lembut dan manis sederhana bersama sedikit rasa karamel. Antara kurma paling mudah diterima ramai kerana tidak terlalu memberat. Ada gred Medium, Large dan Jumbo mengikut saiz biji, serta kotak hadiah siap bungkus untuk diberi.$desc$
  where slug = 'kurma-safawi';

-- Kurma Set & Bundle
update public.categories set description = $desc$Set dan bundle kurma — gabungan beberapa jenis kurma dalam satu pakej. Sesuai untuk hadiah, hidangan majlis, atau bila anda mahu mencuba beberapa jenis sekali gus tanpa perlu membeli setiap satu secara berasingan.$desc$
  where slug = 'kurma-set-bundle';

-- Kurma Sukkari
update public.categories set description = $desc$Kurma Sukkari dari Arab Saudi, kuning keemasan dan sangat manis — namanya sendiri berasal daripada perkataan gula. Ada dua bentuk: versi kering yang lebih pejal dan senang dibawa, serta Rotab yang masih lembap dan gebu, disimpan sejuk beku dan dimakan sejuk seperti pencuci mulut.$desc$
  where slug = 'kurma-sukkari';

-- Lain-lain
update public.categories set description = $desc$Produk lain yang belum dimasukkan ke dalam kategori khusus.$desc$
  where slug = 'lain-lain';

-- Makanan & Minuman
update public.categories set description = $desc$Makanan dan minuman selain buah — serunding ayam dan daging untuk hidangan raya, jagung bakar sedia makan, dan jus buah dalam botol. Pilihan tambahan bila anda mahu lengkapkan pesanan dengan sesuatu yang boleh terus dihidang.$desc$
  where slug = 'makanan-minuman';

-- Pakej Buah
update public.categories set description = $desc$Pakej buah campuran yang dipilih dan disusun siap. Sesuai sebagai hadiah, hidangan mesyuarat, atau bila anda mahu pelbagai jenis buah tanpa perlu memilih satu per satu.$desc$
  where slug = 'pakej-buah';

-- Ready to Eat
update public.categories set description = $desc$Makanan sedia makan yang hanya perlu dipanaskan mengikut arahan pada pembungkusan. Sesuai untuk snek petang, bekal hujung minggu, atau bila anda mahu sesuatu yang cepat tanpa perlu memasak.$desc$
  where slug = 'ready-to-eat';

-- Serunding
update public.categories set description = $desc$Serunding ayam dan daging — isi disuwir halus dan dimasak bersama rempah serta kelapa sehingga kering dan gebu. Hidangan raya klasik bersama ketupat, lemang dan nasi impit, dan sedap juga dengan nasi panas atau disapu dalam roti. Kerana ia kering, serunding tidak perlu disimpan dalam peti sejuk — cukup bekas tertutup di tempat kering.$desc$
  where slug = 'serunding';

-- Sitrus
update public.categories set description = $desc$Oren dan buah sitrus — mandarin yang senang dikupas dengan jari, oren kecil manis untuk snek, Navel bersaiz besar tanpa biji untuk dimakan terus, Valencia untuk dijus, dan lemon untuk masakan serta air detox. Setiap satu ada tujuan berbeza, jadi pilih ikut sama ada anda mahu makan terus atau memerah jus.$desc$
  where slug = 'sitrus';

-- Sahkan selepas jalan:
-- select count(*) filter (where coalesce(description,'') <> '') as ada,
--        count(*) as jumlah from public.products where is_active;
-- select count(*) filter (where coalesce(description,'') <> '') as ada,
--        count(*) as jumlah from public.categories;
