# 🎯 Papan Pencapaian SEO / AEO / GEO — SyababFresh
> Fail ini "save file" kita. Task berjadual baca ini setiap pagi untuk tahu setakat mana kita.
> Bila sesuatu disiapkan, tick kotaknya, tambah mata, kemas kini streak, dan commit.

## 🏆 SASARAN AKHIR (Boss Level)
**"buah online" muncul di PAGE 1 (Top 10) Google Malaysia.**
Ukur guna Google Search Console (Performance → Queries → "buah online" → Average position ≤ 10).

## 📊 Skor Semasa
- **Mata:** 240
- **Level:** 2 — Membina 🎉 *(naik dari Lv1 hari ini)*
- **Streak:** 1 hari berturut-turut
- **Pencapaian dibuka:** 6 / 14
- **Kemaskini terakhir:** 21 Julai 2026

> Level: 0–200 mata = Lv1 Baru Bermula · 201–500 = Lv2 Membina · 501–1000 = Lv3 Naik Carta · 1001+ = Lv4 Juara Carian

---

## ✅ SUDAH SIAP SEBELUM PAPAN INI DIBUAT (21 Julai 2026)
> Asas yang sudah wujud tetapi tiada kotaknya dalam senarai di bawah. Direkodkan
> supaya papan ini bermula dari keadaan sebenar, bukan sifar. Tiada mata diberi —
> ini garis permulaan, bukan pencapaian baharu.

**Infrastruktur teknikal**
- `robots.txt` — sekat `/api/`, `/admin/`, `/checkout/`, `/cart`, `/profile/`, `/tetapan/`
- `sitemap.ts` dinamik — 125 URL; produk & kategori auto-masuk; page pendua dan
  kategori kosong ditapis keluar
- Canonical kendiri semua page; `metadataBase`; OG penuh (`ms_MY`)
- Pengesahan Google Search Console + Google Business Profile (aktif)
- Feed Google Merchant Center `/merchant-feed.xml` (belum disambung ke MC)

**Structured data (JSON-LD)** — 8 jenis
- Organization, WebSite, GroceryStore/LocalBusiness (semua page)
- Product + AggregateRating + BreadcrumbList (page produk)
- Article + FAQPage (artikel panduan)
- ItemList + BreadcrumbList (page kategori)

**Kandungan**
- **94 description produk** — sebelum ini 93 daripada 94 kosong dan semua page
  berkongsi satu ayat fallback yang sama (duplicate content)
- **33 description kategori**
- **24 page kategori** `/kategori/[slug]` dengan metadata, H1 dan ItemList sendiri —
  sebelum ini kategori hanya parameter URL, sifar page
- 4 artikel panduan
- `llms.txt` untuk enjin AI (AEO/GEO)

**Titik permulaan Google Search Console (3 bulan hingga 21 Julai 2026)**
| Metrik | Nilai |
|---|---|
| Klik | 53 |
| Impression | 958 |
| CTR | 5.5% |
| Kedudukan purata | 3.1 (tinggi kerana hampir semua query jenama) |
| Jumlah query | 42 |
| Klik bukan-jenama | **0** |

> Inilah nombor sebenar yang perlu dikalahkan. 66% klik datang dari orang yang
> taip nama "syabab fresh" — mereka sudah kenal kedai. Kejayaan bermakna klik
> bukan-jenama naik dari sifar.

---

## 🏗️ ASAS TEKNIKAL (quick wins — mudah, mula sini)
- [x] **H1 laman utama** — `src/app/page.tsx` (+30 mata) ✔ 21 Jul
- [x] **H1 katalog** — `src/components/storev2/sf-catalog.tsx` (+30) ✔ 21 Jul
- [x] **BreadcrumbList schema** pada halaman produk (+40) ✔ 21 Jul
- [x] **Pautan panduan dari homepage** — internal linking (+40) ✔ 21 Jul
- [ ] **Semakan kelajuan (Core Web Vitals)** — LCP < 2.5s pada homepage & katalog (+50)

## 📝 KANDUNGAN (AEO / GEO — bawa pembeli & autoriti)
- [x] **6 artikel panduan** (sekarang 4 → tambah 2) (+60) ✔ 21 Jul — `jenis-kurma-malaysia`, `panduan-kurma-ajwa`
- [ ] **8 artikel panduan** (+60)
- [x] **FAQ + FAQPage schema pada katalog** (soalan pembeli: "berapa lama sampai", "kawasan hantar") (+40) ✔ 21 Jul — 6 soalan, dipapar + schema
- [ ] **Halaman kluster "Buah Online"** — landing page fokus untuk terma sasaran, paut ke kategori & panduan (+80)

## 🔍 RANKING (ukur via Google Search Console)
- [ ] 🌱 **5 terma long-tail dapat impressions** dalam GSC (dah diindeks & muncul) (+50)
- [ ] 🥉 **Top 10 untuk 1 terma long-tail** (cth "ceri turki online" / "kurma ajwa online") (+100)
- [ ] 🥈 **Top 10 untuk 3 terma long-tail** (+150)
- [ ] 🥇 **"buah online" masuk Top 20** (page 2) (+200)
- [ ] 🏆 **"buah online" PAGE 1 / Top 10** — BOSS LEVEL (+500)

---

## 🪜 Tangga Kata Kunci Sasaran
Menang bawah dulu, naik ke atas:
1. "buah import online" · "kurma ajwa online malaysia" · "ceri turki online" · "buah segar online klang valley" *(mudah — mula sini)*
2. "beli buah online malaysia" · "kedai buah online" *(sederhana)*
3. **"buah online"** *(sasaran akhir)*

## 🔥 Streak & Log Harian
> Setiap hari ada penambahbaikan di-commit = streak +1. Terlepas sehari = streak reset ke 0.
> Format: `Tarikh — apa disiapkan — mata — streak`

| Tarikh | Disiapkan | Mata | Streak |
|--------|-----------|------|--------|
| 21 Jul 2026 | BreadcrumbList produk · H1 homepage · H1 katalog · pautan panduan dari homepage | +140 | 1 |
| 21 Jul 2026 | 2 artikel panduan baharu (jenis kurma Malaysia · panduan kurma Ajwa) | +60 | 1 |
| 21 Jul 2026 | Pautan dalaman artikel → page kategori (11 pautan) | +0 | 1 |
| 21 Jul 2026 | FAQ + FAQPage schema pada katalog — **naik Level 2** | +40 | 1 |

---

### Cara guna (untuk Claude Code)
Bila anda siapkan mana-mana item di atas:
1. Tukar `[ ]` kepada `[x]` pada item tu.
2. Tambah mata ke "Skor Semasa", kemas kini Level jika lepas ambang.
3. Streak +1 (kalau ini penambahbaikan pertama hari ini), kemas kini tarikh.
4. Tambah satu baris dalam jadual Log Harian.
5. Commit: `chore(seo): unlock [nama pencapaian] +[mata] mata`
