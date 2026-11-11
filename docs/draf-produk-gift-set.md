# Draf: 3 produk gift set sedia-jual — kategori `kurma-set-bundle` (untuk B2)

**Status:** DRAF 10 Nov 2026. **Belum masuk DB** — data produk hak pemilik; Claude Code tidak
insert sendiri. B2 (+40) pada `docs/seo-geo-progress.md` hanya ditick bila pemilik sahkan
produk live di storefront/feed.

> **Kemas kini 11 Nov:** pemilik dah ada harga **Ready-made rasmi** dalam sheet *MASTER HARGA KURMA
> 2027 › Harga Giftbox 2027* (kategori "Ready-made": 7 kurma + Royal Dates × 100g/200g/500g/1kg × tier
> 1/10/50/100/300, lengkap dengan kos). Bila masukkan produk, **guna harga sheet itu**, bukan anggaran di
> bawah — kos PLACEHOLDER (Medjoul RM45/kg, Ajwa Large RM27/kg, kotak 500g RM4, dll.) kini ada dalam
> sheet. Sheet itu juga dipapar di `/admin/kurma/costs` (kategori Ready-made) selepas "Tarik dari Sheet".

Semakan 10 Nov: **0 produk** dalam `kurma-set-bundle`, `gift-box`, `gift-box-set` (aktif atau
tidak). Yang paling hampir ialah 3 produk kurma tunggal "Premium (Kotak)" — jadi anchor harga
kotak sedia ada:

| Produk sedia ada | 250g | 500g |
|---|---|---|
| AJWA Aliyah Premium (Kotak) | RM28 | RM39 |
| MARIAMI Premium (Kotak) | RM25 | RM35 |
| SAFAWI Jumbo Premium (Kotak) | RM25 | RM35 |

## Sempadan — ini BUKAN custom korporat

- `/kurma` (Gift Studio) = kotak **custom jenama syarikat**, RM4.50–RM27/kotak, min 50, ikut
  sebut harga & deposit. Kekal seperti sedia ada.
- Draf ini = **produk tetap**, reka bentuk standard SyababFresh, beli terus di storefront
  (troli → bayar) tanpa sebut harga. Description setiap produk hala pelanggan yang mahu logo /
  kuantiti besar ke Studio — dua-dua saling melengkapi, bukan bersaing.

## Sumber angka (supaya pemilik boleh semak)

- **Harga runcit** = DB 10 Nov 2026 (varian aktif).
- **Kos** = sheet GIFT BOX CUSTOM 2026 (`app_settings.gift_cost_sheet`, tarik 25 Okt), tier qty
  500: kotak 500g RM2.59 · 250g RM2.30 · 100g RM2.00; ziplock RM0.06–0.10; upah RM0.25–0.30;
  lain RM0.10–0.30. Kos kurma tersirat dari sheet: Ajwa Medium/A ≈ RM18/kg · Mariami A ≈
  RM15/kg · Mariami AA ≈ RM23/kg · Safawi Medium ≈ RM15/kg · Libya/Tunisia ≈ RM12/kg.
- **TIADA dalam sheet → PLACEHOLDER** (angka di bawah anggaran kasar, pemilik ganti): Medjoul,
  Safawi Jumbo, badam, kismis, kotak hamper keras, reben/kad.
- Margin sheet pemilik 30–55%. Draf sasar **≥50%** untuk gift (ada premium persembahan),
  ~35–45% untuk doorgift (volum). Semua margin **sebelum** kos pos & komisyen platform.

## Medan DB yang sama untuk ketiga-tiga produk

| Medan | Nilai | Sebab |
|---|---|---|
| `category_id` | kategori `kurma-set-bundle` (parent `kurma`) | Feed MC auto → "Food, Beverages & Tobacco > Food Gift Baskets" (ff0ceed) |
| `is_cold` | **false** | Kurma kering — kalau true, Poslaju tak terpilih & kos courier naik |
| `is_shippable` / `show_in_storefront` | true / true | |
| `unit` | `set` (P1, P2) · `pek` (P3) | |
| `compare_price` | **kosong** | Jangan guna "nilai berasingan" sebagai harga coret — pelanggan baca sebagai harga asal (tak jujur) |
| `weight_grams` | isi sebenar (lihat setiap produk) | Jangan biar placeholder 100g — kos pos tersilap |
| `description` | teks biasa, perenggan (bukan HTML) | Format sama `draf-description-produk.md`; masuk schema `Product` |
| `images` | 3 gambar, nisbah 1:1, ≥1200px | Upload via admin → WebP automatik |

Selepas produk live, dua tambahan kod kecil (additive, Claude Code boleh buat):
1. `src/lib/kurma-shop.ts` `SHOP_SECTIONS` — tambah `{ id: 'gift-set', title: 'Gift Set', slugs: ['kurma-set-bundle'] }`
   (tanpa ini produk muncul di shop.syababfresh.my & feed tetapi **tidak** di `/kurma/shop`).
2. `merchant-feed.xml` — `<g:is_bundle>yes</g:is_bundle>` untuk item `kurma-set-bundle`
   (atribut Google untuk bundle takrifan peniaga; elak Merchant Center tandakan "harga tak padan").

---

## Produk 1 — Gift Box Kurma Duo (Ajwa + Medjoul)

| | |
|---|---|
| **Nama** | Gift Box Kurma Duo (Ajwa + Medjoul) |
| **Slug** | `gift-box-kurma-duo-ajwa-medjoul` |
| **Kategori** | `kurma-set-bundle` |
| **Kandungan** | Ajwa Madinah Medium 250g + Medjoul Palestin Large 250g, dibungkus berasingan dalam kotak 500g dua petak (template `pizza-500g` / tuck box sedia ada, cetakan standard SyababFresh) + reben + kad ucapan kosong |
| **Berat** | `weight_grams` ≈ 700 (500g isi + kotak) |
| **Frasa sasaran** | gift kurma · hamper kurma · gift box kurma Ajwa Medjoul |

**Description (±85 patah):**

```
Gift kurma dua jenis dalam satu kotak: Ajwa Madinah gred Medium yang lembut dan tidak
melekit, bersama Medjoul Palestin saiz Large yang tebal berisi dengan rasa karamel. Setiap
jenis 250g, dibungkus berasingan dalam kotak persembahan dua petak, siap dengan reben —
terus boleh dihadiahkan tanpa perlu bungkus semula.

Sesuai sebagai hamper kurma ringkas untuk ibu bapa, rakan sekerja, tetamu majlis atau
hantaran Ramadan. Kurma kering, tahan lama tanpa peti sejuk; dipos ke seluruh Semenanjung
Malaysia.

Mahu kotak dengan logo syarikat atau kuantiti besar? Lihat Gift Box Kurma Custom di
kurma.syababfresh.my.
```

**Harga — nilai runcit longgar** (dari DB): Ajwa Medium 300g RM21 → 250g ≈ RM17.50; Medjoul
Large 300g RM35 → 250g ≈ RM29.20. **Jumlah ≈ RM47** tanpa kotak.

**Kos seunit (anggaran):**

| Item | RM | Nota |
|---|---|---|
| Ajwa Medium 250g | 4.50 | sheet ≈ RM18/kg |
| Medjoul Large 250g | **12.50 PLACEHOLDER** | andaian ≈ RM50/kg — Medjoul tiada dalam sheet |
| Kotak 500g | 2.59 | sheet tier 500 |
| Ziplock 250g ×2 | 0.20 | |
| Upah | 0.30 | |
| Lain (pelekat, label) | 0.30 | |
| Reben + kad | **0.80 PLACEHOLDER** | |
| **Jumlah** | **≈ 21.20** | |

**Cadangan harga: RM55** → untung ≈ RM33.80, margin ≈ 61%. *(Alternatif promo RM49 → ≈ 57%.)*
Anchor: dua "Premium (Kotak)" 250g berasingan = RM25 + RM28 = RM53, dan Medjoul lebih mahal
daripada Mariami — RM55 selaras. **PEMILIK SAHKAN:** kos Medjoul sebenar & margin.

Varian pilihan (jika mahu): "Duo Jumbo" (Ajwa Jumbo + Medjoul Jumbo) ≈ RM69.

**Nota gambar (3):** (1) kotak tertutup, latar putih/neutral, reben nampak; (2) kotak terbuka
tunjuk dua petak Ajwa & Medjoul; (3) flat lay — kurma dikeluarkan sedikit, kad ucapan, tanpa
teks promosi dalam gambar. Alt automatik dari nama produk.

---

## Produk 2 — Hamper Kurma Raya Premium

| | |
|---|---|
| **Nama** | Hamper Kurma Raya Premium |
| **Slug** | `hamper-kurma-raya-premium` |
| **Kategori** | `kurma-set-bundle` |
| **Kandungan** | 3 jenis kurma: Ajwa Madinah Medium 250g · Safawi Jumbo 250g · Medjoul Palestin Large 250g + Badam panggang 100g + Kismis Golden Jumbo 100g (semua produk sedia ada di `/kurma/shop`) — kotak hamper keras/dulang + reben + kad ucapan kosong |
| **Berat** | `weight_grams` ≈ 1500 (950g isi + kotak hamper) |
| **Musim** | Papar dari Jan 2027; Ramadan 2027 ≈ awal Feb, Aidilfitri ≈ pertengahan Mac (sahkan takwim). Selepas Raya: tukar nama → "Hamper Kurma Premium" atau nyahaktif |
| **Frasa sasaran** | hamper kurma · hamper kurma Raya · gift kurma premium |

**Description (±80 patah):**

```
Hamper kurma Raya lengkap dengan tiga jenis kurma pilihan — Ajwa Madinah Medium, Safawi
Jumbo dan Medjoul Palestin Large, 250g setiap satu — ditemani badam panggang dan kismis
golden jumbo (100g setiap satu). Semua disusun dalam kotak hamper keras dengan reben dan kad
ucapan kosong untuk anda tulis sendiri.

Gift kurma premium untuk keluarga, bos, pelanggan atau jiran pada musim Ramadan dan
Aidilfitri. Isi hamper kering dan tahan lama, selamat dipos ke seluruh Semenanjung. Tempah
awal untuk penghantaran sebelum Ramadan.
```

**Harga — nilai runcit longgar:** Ajwa 250g 17.50 + Safawi Jumbo 250g 16.70 (300g RM20) +
Medjoul Large 250g 29.20 + Badam 100g 14 + Kismis Golden Jumbo 100g 13 = **≈ RM90**.

**Kos seunit (anggaran):**

| Item | RM | Nota |
|---|---|---|
| Ajwa Medium 250g | 4.50 | sheet |
| Safawi Jumbo 250g | **6.25 PLACEHOLDER** | sheet hanya Safawi Medium (RM15/kg); Jumbo andaian RM25/kg |
| Medjoul Large 250g | **12.50 PLACEHOLDER** | |
| Badam panggang 100g | **4.00 PLACEHOLDER** | runcit 1kg RM69 |
| Kismis Golden Jumbo 100g | **2.50 PLACEHOLDER** | runcit 1kg RM55 |
| Kotak hamper keras + dulang | **10.00 PLACEHOLDER** | tiada dalam sheet |
| Ziplock ×5 | 0.50 | |
| Upah | 0.50 | |
| Lain | 0.50 | |
| Reben + kad | 1.00 | |
| **Jumlah** | **≈ 42.25** | |

**Cadangan harga: RM119** → untung ≈ RM76.75, margin ≈ 64%. *(Alternatif RM99 → ≈ 57%, jika
kotak hamper < RM6 atau untuk pra-tempahan awal.)* **PEMILIK SAHKAN:** 5 kos placeholder +
pembekal kotak hamper.

**Nota gambar (3):** (1) hamper penuh dari sudut 45°, semua 5 item nampak label; (2) atas
(top-down) susunan dalam kotak; (3) gaya meja Raya — ketupat/pelita sebagai prop ringkas,
jangan tenggelamkan produk. Tiada teks "Raya" dalam gambar supaya boleh guna semula lepas
musim.

---

## Produk 3 — Mini Gift Kurma Cenderahati

| | |
|---|---|
| **Nama** | Mini Gift Kurma Cenderahati |
| **Slug** | `mini-gift-kurma-cenderahati` |
| **Kategori** | `kurma-set-bundle` |
| **Kandungan** | 1 kotak mini standard SyababFresh berisi 100g kurma pilihan + reben + tag "Terima kasih" generik. Jenis: Mariami A · Safawi Medium · Ajwa Medium |
| **Min order** | Tiada medan `min_qty` dalam `products` → jual sebagai **varian pek**: Pek 20 · Pek 50 · Pek 100. Guna `variant_options` (migration 136): dimensi *Jenis kurma* × *Saiz pek* → 9 kombinasi via penjana kombinasi admin |
| **Berat** | ≈ 140g/kotak → Pek 20 ≈ 3000g · Pek 50 ≈ 7000g · Pek 100 ≈ 14000g. `weight_grams` di peringkat produk — **semak** sama ada varian ada berat sendiri; kalau tidak, Pek 50/100 mungkin perlu kos pos manual/Lalamove |
| **Frasa sasaran** | doorgift kurma · cenderahati kurma · gift kurma majlis |

**Description (±85 patah):**

```
Mini gift kurma untuk cenderahati majlis — kotak kecil berisi 100g kurma pilihan (Mariami,
Safawi atau Ajwa) dengan reben, siap untuk diberi kepada tetamu. Sesuai untuk doorgift
kenduri, majlis akikah, iftar pejabat, kelas mengaji atau sebagai tanda terima kasih kepada
staf.

Dijual dalam pek 20, 50 atau 100 kotak; harga seunit lebih rendah untuk pek besar. Reka
bentuk standard SyababFresh tanpa cetakan nama. Perlukan logo syarikat, kuantiti melebihi
100 atau isi lain? Gift Box Kurma Custom di kurma.syababfresh.my sedia dengan sebut harga.
```

**Kos seunit (anggaran, Mariami A / Safawi Medium):** kurma 100g 1.50 + kotak mini 2.00 (sheet
tier 500 — **qty kecil mungkin lebih mahal, PLACEHOLDER**) + ziplock 0.06 + upah 0.30 + lain
0.30 + reben 0.30 = **≈ 4.46**. Ajwa Medium: kurma 1.80 → **≈ 4.76**.

**Cadangan harga (seunit → harga varian pek):**

| Jenis | Pek 20 | Pek 50 | Pek 100 |
|---|---|---|---|
| Mariami A | RM7.50 → **RM150** (≈40%) | RM6.90 → **RM345** (≈35%) | RM6.50 → **RM650** (≈31%) |
| Safawi Medium | RM7.50 → **RM150** | RM6.90 → **RM345** | RM6.50 → **RM650** |
| Ajwa Medium | RM8.50 → **RM170** (≈44%) | RM7.90 → **RM395** (≈40%) | RM7.50 → **RM750** (≈37%) |

Rujukan sheet Studio (custom, qty 500, 100g): Mariami A RM6.60 · Safawi Medium RM6.90 · Ajwa
Medium RM7.90. Pek 100 sedia-jual tanpa cetakan sedikit di bawah custom qty 500 — logik,
tetapi **PEMILIK SAHKAN** supaya tidak memotong tier Studio pada kuantiti sama (min tier Studio
untuk 100g).

**Nota gambar (3):** (1) satu kotak mini dengan reben, dekat (close-up); (2) susunan 20 kotak
dalam dulang/pek — tunjuk ia dijual berpek; (3) tiga jenis kurma bersebelahan dengan label
jenis. Gambar sama untuk semua 9 varian (tiada gambar per varian).

---

## Checklist pemilik sebelum live

- [ ] Sahkan/ganti semua **PLACEHOLDER** kos (Medjoul, Safawi Jumbo, badam, kismis, kotak hamper, reben)
- [ ] Sahkan harga akhir & margin ketiga-tiga produk
- [ ] Tetapkan pembekal kotak 500g dua petak & kotak hamper; stok reben/kad/tag
- [ ] Ambil 3 gambar setiap produk ikut nota di atas
- [ ] Masukkan produk di `/admin/products/new` (kategori `kurma-set-bundle`, `is_cold` = false, berat sebenar)
- [ ] Produk 3: cipta `variant_options` Jenis × Saiz pek, jana 9 kombinasi, isi harga pek

## Selepas pemilik sahkan live (untuk Claude Code)

1. Tambah seksyen `gift-set` dalam `SHOP_SECTIONS` (`src/lib/kurma-shop.ts`); tambah `g:is_bundle` dalam feed.
2. Sahkan: produk 200 di storefront; `curl /merchant-feed.xml | grep "Food Gift Baskets"` ada item.
3. Tick **B2** di `docs/seo-geo-progress.md` (+40, hash commit, tarikh), kemas kini mata/streak, Log Harian.
4. Commit: `chore(seo): unlock B2 produk gift set dalam kedai / feed +40 mata`
