# 🌴 Papan Pencapaian SEO / AEO / GEO — SyababFresh KURMA
> Fail ini "save file" kita. Task berjadual baca ini setiap pagi untuk tahu setakat mana kita.
> Bila sesuatu disiapkan, tick kotaknya, tambah mata, kemas kini streak, dan commit.
> **Reset 18 Okt 2026** — fokus bertukar dari "buah online" ke KURMA atas arahan pemilik.
> Aset "buah online" (pillar, artikel, schema) KEKAL dalam kod — jangan buang, bina kurma di atasnya.

## 🏆 SASARAN AKHIR (Boss Level)
**"kurma online" DAN "gift kurma" muncul di PAGE 1 (Top 10) Google Malaysia SEBELUM Ramadan 2027.**
- Ramadan 2027 dijangka bermula ±8 Feb 2027 → **deadline kerja besar: akhir Januari 2027.**
- Ukur guna Google Search Console, Domain property `syababfresh.my` (Performance → Queries → Average position ≤ 10).
- Strategi tangga: menang long-tail dulu → naik "beli kurma online" / "kedai kurma online" → akhirnya "kurma online" + "gift kurma".
- URL sasaran kurma: subdomain **kurma.syababfresh.my** (canonical; pautan dari shop.syababfresh.my = "backlink" dalaman).

## 📊 Skor Semasa
- **Mata:** 940
- **Level:** 3 — Naik Carta 🚀
- **Streak:** 2 hari *(putus 28 Okt–1 Nov; sambung 2 Nov, 3 Nov — rekod jujur)*
- **Pencapaian dibuka:** 9 / 20
- **Kemaskini terakhir:** 3 Nov 2026

> Level: 0–200 mata = Lv1 Baru Bermula · 201–500 = Lv2 Membina · 501–1000 = Lv3 Naik Carta · 1001+ = Lv4 Juara Carian
> Nota skor: 720 mata dibawa dari papan "buah online" (sejarah penuh dalam Log Harian di bawah) + 30 (A5 GSC) + 80 (D1 Merchant Center), kedua-dua 2 Nov + 40 (B3) + 40 (A4) + 30 (C5), ketiga-tiga 3 Nov. **Trek A SIAP 5/5.**

## 📅 Fasa Runway Ramadan 2027
| Fasa | Tempoh | Fokus |
|---|---|---|
| 1 · Asas Kurma | Okt–Nov | Trek A siap, funnel gift ber-schema |
| 2 · Kandungan | Nov–Dis | Trek C — artikel ditulis Nov/Dis inilah yang ranking menjelang Ramadan (indexing 4–8 minggu) |
| 3 · Tolakan | Jan | Trek D penuh + pautan/pembaikan akhir; deadline akhir Jan |
| 4 · Musim | Feb–Mac | STOP SEO besar — konversi, stok, kandungan ringan sahaja |

---

## ✅ GARIS PERMULAAN (siap sebelum reset 18 Okt — tiada mata, ini bukan pencapaian baharu)
- Asas teknikal penuh kedai utama: robots, sitemap dinamik (120+ URL), canonical, OG, JSON-LD 8 jenis, 94 description produk, 24 page kategori, pillar /buah-online, 8 artikel (2 kurma: `jenis-kurma-malaysia`, `panduan-kurma-ajwa`), llms.txt, GSC + GBP aktif
- Funnel kurma sedia wujud: `/kurma` (gift landing + FAQPage), `/kurma/shop` (kedai kering: Ajwa, Safawi, Medjoul, Mariami, Sukkari, serunding, buah kering, kismis, kacang + ItemList), `/kurma/korporat`, `/kurma/borong`, `/kurma/portfolio`, sitemap kurma sendiri
- Kategori DB jenis kurma: `kurma-ajwa`, `kurma-safawi`, `kurma-medjoul`, `kurma-mariami`, `kurma-sukkari` → page `/kategori/[slug]`
- Feed Merchant Center `/merchant-feed.xml` — kod siap DAN sudah didaftar di MC sebagai feed File (URL) "PRODUCTS SOURCE 4", fetch harian (rupanya aktif sebelum reset; direkod rasmi sebagai D1 pada 2 Nov)

---

## 🅰️ TREK A — ASAS KURMA (5 pencapaian)
- [x] **A1 · Frasa "kurma online" dalam metadata root** — `src/app/layout.tsx` (description + OG + Twitter) (+10) ✔ 23 Okt (7d084c3)
- [x] **A2 · llms.txt kluster kurma** — 3 Key pages (/kurma/shop · /kurma · /kurma/korporat) + ayat pengenalan sebut kurma/gift box (+20) ✔ 27 Okt (490b8a5)
- [x] **A3 · Pautan dalaman kedai utama → kurma** — homepage, /buah-online, 2 artikel kurma, footer; semua via `kurmaPath()` (+40) ✔ 27 Okt (3ef8f69)
- [x] **A4 · FAQ + FAQPage schema pada /kurma/shop** — 6 soalan pembeli (beza 5 jenis, tempoh pos, simpanan, gift → /kurma, Ramadan 2027, borong → /kurma/borong) dipapar dalam UI + `faqPageSchema`; data `SHOP_FAQ` di lib/kurma-shop.ts (+40) ✔ 3 Nov (ba9bbf6) — **Trek A SIAP**
- [x] **A5 · GSC Domain property `syababfresh.my` + submit sitemap kurma** — kurma.syababfresh.my kini dijejak; sitemap kurma Success, 5 pages discovered (+30) ✔ 2 Nov (manual pemilik)

## 🅱️ TREK B — GIFT / HAMPER KURMA (4 pencapaian)
- [x] **B1 · JSON-LD funnel gift** — BreadcrumbList /kurma, /korporat, /borong (URL ikut subdomain via `kurmaAbs`) + Service "Gift Box Kurma Custom" RM4.50–RM27/kotak min 50 (+40) ✔ 23 Okt (76b09c4)
- [ ] **B2 · Produk gift set dalam kedai / feed** — produk gift set yang pemilik sedang bina masuk DB & papar di storefront/feed (status DB — sahkan dengan pemilik, jangan anggap dari kod) (+40)
- [x] **B3 · Frasa tepat "gift kurma" dalam H1/metadata funnel gift** — frasa literal "gift kurma" & "hamper kurma" kini dalam metaDesc + sub hero /kurma (varian default), metaDesc /kurma/ramadan ("gift kurma Raya & hamper kurma Ramadan") dan KORPORAT_META.description ("hamper kurma korporat"); H1 & metaTitle tidak diubah (+40) ✔ 3 Nov (383ab63)
- [ ] **B4 · Portfolio gift ber-schema** — /kurma/portfolio dengan ImageObject/Review schema + alt text kaya kata kunci (+30)

## 🅲 TREK C — KANDUNGAN (5 pencapaian)
- [ ] **C1 · Artikel "Panduan Gift Kurma & Hamper Kurma Korporat"** — sasar "gift kurma", "hamper kurma", "gift kurma raya"; fakta harga dari gift-pricing sebenar; paut /kurma, /korporat, /shop (+60)
- [ ] **C2 · Artikel kurma #4** — cth "Kurma Medjool vs Ajwa: mana satu untuk anda" atau "Kelebihan kurma untuk berbuka" (+60)
- [ ] **C3 · Artikel kurma #5 — persediaan Ramadan** — "Bila patut order kurma untuk Ramadan 2027" (timeline, borong vs runcit, gift korporat) (+60)
- [ ] **C4 · Pautan dua hala artikel kurma ↔ funnel** — semua artikel kurma paut /kurma/shop & /kurma dengan anchor variasi; artikel lama kurma paut artikel baharu (+40)
- [x] **C5 · FAQ Ramadan pada funnel gift** — GIFT_FAQ kini 9 soalan: +"Bila patut tempah gift kurma untuk Ramadan 2027?" (Ramadan ±8 Feb 2027, sahkan design & deposit sebelum 1 Feb, lead time ~2 minggu) + "Perlu bayar deposit? Berapa?" (50% ikut `DEFAULT_DEPOSIT_PCT`); kuantiti minimum & ~2 minggu sedia ada; auto masuk FAQPage /kurma, /kurma/ramadan & /kurma/korporat (soalan deposit pendua di korporat dibuang) (+30) ✔ 3 Nov

## 🅳 TREK D — JUALAN SEGERA (3 pencapaian — MANUAL pemilik)
- [x] **D1 · Merchant Center** — feed File (URL) "PRODUCTS SOURCE 4" aktif di MC: 310 produk, fetch harian (kemas kini terakhir 2 Nov 00:00), 308 approved, 212 klik/28 hari; produk kurma muncul percuma di tab Shopping; sumber Content API lama (36 produk gla_ dari plugin WooCommerce, termasuk produk sampel & domain tak padan) dipadam 2 Nov (+80) ✔ 2 Nov (disahkan pemilik — feed sudah aktif, pembersihan sumber lama kerja 2 Nov)
- [ ] **D2 · Google Business Profile** — tambah produk kurma/gift box + 1 post kurma di GBP (+40)
- [ ] **D3 · Saluran segera ketiga** — katalog WhatsApp Business kurma ATAU feed produk ke Meta/TikTok shop (+30)

## 🅴 TREK E — RANKING (3 pencapaian — ukur via GSC Domain property)
- [ ] **E1 🌱 · 5 terma kurma long-tail dapat impressions** ("kurma ajwa online malaysia", "kurma medjool online", "gift kurma raya", "hamper kurma korporat", "beli kurma online") (+50)
- [ ] **E2 🥉 · Top 10 untuk 3 terma long-tail kurma** (+150)
- [ ] **E3 🏆 · "kurma online" + "gift kurma" PAGE 1 / Top 10 — BOSS LEVEL** (+500)

---

## 🪜 Tangga Kata Kunci Sasaran
1. "kurma ajwa online malaysia" · "kurma medjool online" · "gift kurma raya" · "hamper kurma korporat" *(mudah — mula sini)*
2. "beli kurma online" · "kedai kurma online" *(sederhana)*
3. **"kurma online" + "gift kurma"** *(sasaran akhir — sebelum Ramadan 2027)*

## 🔥 Streak & Log Harian
> Setiap hari ada penambahbaikan di-commit = streak +1. Terlepas sehari = streak reset ke 0.
> Format: `Tarikh — apa disiapkan — mata — streak`

| Tarikh | Disiapkan | Mata | Streak |
|--------|-----------|------|--------|
| 21 Jul 2026 | BreadcrumbList produk · H1 homepage · H1 katalog · pautan panduan dari homepage | +140 | 1 |
| 21 Jul 2026 | 2 artikel panduan baharu (jenis kurma Malaysia · panduan kurma Ajwa) | +60 | 1 |
| 21 Jul 2026 | Pautan dalaman artikel → page kategori (11 pautan) | +0 | 1 |
| 21 Jul 2026 | FAQ + FAQPage schema pada katalog — **naik Level 2** | +40 | 1 |
| 21 Jul 2026 | Halaman kluster /buah-online (pillar page) | +80 | 1 |
| 21 Jul 2026 | 2 artikel panduan lagi (anggur import · cara simpan buah) — 8 artikel | +60 | 1 |
| 22 Jul 2026 | Core Web Vitals diaudit (homepage LCP 1.7s · /products 2.1s) — lulus | +50 | 2 |
| 22 Jul 2026 | Pautan dua hala kluster buah-online (4 artikel + indeks → pillar) | +40 | 2 |
| 23 Jul 2026 | Footer 4-lajur (nama syarikat + SSM) · halaman refund & privasi · email kontak — E-E-A-T/trust | +0 | — |
| 27 Jul 2026 | FAQ + FAQPage pillar /buah-online (+40) · varian Klang Valley (+30) — **naik Level 3** | +70 | 1 |
| 27 Jul 2026 | Pautan produk → panduan (94 page, +40) · llms.txt kemas kini kluster (+20) | +60 | 1 |
| 13 Ogos 2026 | Frasa tepat "buah online" dalam metadata homepage — bonus luar senarai | +10 | 1 |
| 23 Okt 2026 | **A1** Frasa "kurma online" dalam metadata root (7d084c3) | +10 | 1 |
| 23 Okt 2026 | **B1** JSON-LD funnel gift — Breadcrumb + Service gift box (76b09c4) | +40 | 1 |
| 27 Okt 2026 | **A2** llms.txt kluster kurma (490b8a5) | +20 | 1 |
| 27 Okt 2026 | **A3** Pautan dalaman kedai utama → kurma (3ef8f69) | +40 | 1 |
| 2 Nov 2026 | **A5** GSC Domain property syababfresh.my + submit sitemap kurma (manual pemilik) · papan KURMA menggantikan papan buah-online | +30 | 1 |
| 2 Nov 2026 | **D1** Merchant Center rupanya sudah aktif — feed "PRODUCTS SOURCE 4", 310 produk, 308 approved, 212 klik/28 hari; sumber Content API lama (36 produk gla_ WooCommerce) dipadam (disahkan pemilik) | +80 | 1 |
| 3 Nov 2026 | **B3** Frasa literal "gift kurma" & "hamper kurma" dalam metaDesc + sub hero /kurma, metaDesc /kurma/ramadan, description /kurma/korporat (gift-copy.ts · korporat-copy.ts) (383ab63) | +40 | 2 |
| 3 Nov 2026 | **A4** FAQ 6 soalan + FAQPage JSON-LD pada /kurma/shop (SHOP_FAQ, pautan ke /kurma & /kurma/borong) — **Trek A SIAP 5/5** (ba9bbf6) | +40 | 2 |
| 3 Nov 2026 | **C5** FAQ Ramadan pada funnel gift — 2 soalan musim (timeline tempah Ramadan 2027 · deposit 50%) dalam GIFT_FAQ → FAQPage /kurma, /ramadan, /korporat | +30 | 2 |

---

### Cara guna (untuk Claude Code)
Bila anda siapkan mana-mana item di atas:
1. Tukar `[ ]` kepada `[x]` pada item tu, tambah tarikh & hash commit.
2. Tambah mata ke "Skor Semasa", kemas kini "Pencapaian dibuka" & Level jika lepas ambang.
3. Streak +1 (kalau ini penambahbaikan pertama hari ini), kemas kini tarikh.
4. Tambah satu baris dalam jadual Log Harian.
5. Commit: `chore(seo): unlock [kod item] [nama pencapaian] +[mata] mata`
Trek D ialah kerja manual pemilik — tick hanya bila pemilik sahkan siap.
Trek E diukur di GSC sahaja — tick hanya bila pemilik tunjuk data GSC.
