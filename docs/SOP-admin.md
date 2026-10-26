# SOP Admin — SyababFresh

Rujukan operasi harian untuk admin/staf. Empat bahagian:
1. [Keluarkan Order](#1-keluarkan-order) — pack & hantar
2. [Settelkan Order](#2-settelkan-order) — import tracking & tutup order
3. [Refund](#3-refund)
4. [Quick Order — Team Sales](#4-quick-order--team-sales) — buat order, tengok order & jualan anda

> **Status order** (ikut sistem):
> `pending` → `confirmed` → `preparing` → `delivering` (customer nampak **"Dihantar"**, detail **"Dalam Penghantaran"**) → `delivered`.
> Lain: `cancelled`, `refunded`. **Setiap tukar status hantar push notification ke customer** — jadi jangan tukar sembarangan.

---

## 1. Keluarkan Order

### 1.1 Tentukan kurier (rujukan pantas)

Sistem cadang kurier automatik di **Admin → Shipping → Export & Import** (lajur *Courier*):

| Jenis item | Kawasan | Kurier | Cara keluarkan |
|---|---|---|---|
| Fresh (sejuk) | **LK** (Lembah Klang) | **Lalamove** (same-day) | Lalamove Grouping (atau Lalamove XLSX) |
| Fresh (sejuk) | **Pos** (luar LK) | **Ninja Cold** | Export **Ninja Cold CSV** |
| Dry sahaja | mana-mana | **Poslaju** | Export **Poslaju XLSX** |
| Fresh, zon tak dikenali | — | **semak dulu** | Betulkan alamat/poskod order |

> Petanda item: 🟢 hijau = item fresh (cold), 🟡 kuning = item dry.
> **LK** = Lembah Klang (→ Lalamove same-day). **Pos** = luar LK (→ kurier: Ninja Cold / Poslaju).

### 1.2 Order Lalamove (Fresh + LK) — same-day

**Admin → Lalamove Groups** (`/admin/lalamove-grouping`)

1. Set **Date**, **Cutoff Order** (default 3:00 PM), dan **Status Orders** (default: confirmed + preparing).
2. Klik **Generate Groups** — order dibahagikan ikut **zon LK** (KL City · Cheras/Ampang · PJ/Damansara · Subang/USJ/Sunway · Shah Alam/Kota Kemuning · Klang/Setia Alam · Kajang/Bangi/Putrajaya · Rawang/Selayang).
   - ⚠️ Order **luar LK diabaikan automatik** (guna Ninja Cold — lihat 1.3). Toast akan papar berapa diabaikan.
3. Semak setiap zon. Guna dropdown pada kad order untuk **pindah zon** kalau silap.
4. Klik **Copy** (per zon) atau **Copy All** → tampal dalam app/portal Lalamove untuk booking.
5. Klik **Save Batch** untuk simpan. Tukar status batch: **Draft → Ready for Lalamove → Booked → Selesai**.
6. Guna **Muatkan Tersave** untuk buka semula batch tarikh tertentu.

### 1.3 Export fail kurier (Ninja Cold / Poslaju / Lalamove)

**Admin → Shipping → Export & Import** (`/admin/shipping/exports`), tab **Export & Print**

1. Pilih julat tarikh (**From / To**) → **Filter**.
2. Guna **chip filter kawasan** untuk asingkan: **Semua / LK / Pos / Lain-lain** (ada kiraan setiap satu).
3. Klik **Select All** (hanya tick order dalam filter semasa) atau tick manual. Pilihan kekal walau tukar filter.
4. Generate ikut kurier (butang ikut warna):
   - **Pos** (fresh, luar LK) → 🔵 **Ninja Cold CSV** → upload ke portal Ninja.
   - **Dry** → 🔴 **Poslaju XLSX** → upload ke EasyParcel/portal Poslaju.
   - **LK** (fresh) → 🟡 **Lalamove XLSX** — helaian rujukan untuk *key-in* ke app Lalamove (telefon dlm bentuk `01x`). _Untuk same-day LK guna **Lalamove Groups** (1.2) lebih senang — Lalamove XLSX cuma alternatif._
5. Fail XLSX/CSV terus muat turun. Nombor telefon & poskod kekal betul (tak jadi notasi saintifik).

> **Format fail:** Ninja Cold = **CSV** (template import portal Ninja). Poslaju & Lalamove = **XLSX** (Excel) supaya angka panjang tak rosak.

> **Alamat tak lengkap** = baris kelabu + amaran ⚠️. Betulkan order dulu sebelum export.

#### ✓ Auto-tanda "sudah export" — elak hantar dua kali

Sebaik je fail dijana, order yang dipilih **auto-ditanda "sudah export"** (badge hijau **✓ Export [tarikh]**) dan **hilang dari senarai** secara default.

- Toggle **"Sorok sudah export (n)"** (atas kanan) — hidup = sorok yang dah export; matikan = **Tunjuk semua** (untuk semak/export semula).
- Kalau staf lain cuba export semula order yang **dah** di-export, sistem **beri amaran** ⚠️ ("order ni DAH di-export sebelum ni …") supaya tak hantar 2 kali.
- Maknanya: **satu order = satu kali export**. Kalau betul-betul perlu export semula (cth silap fail), matikan toggle dulu.

### 1.4 Senarai Pack (pick list — tarik stok)

**Admin → Shipping → Export & Import**, tab **Export & Print**

1. Tick order yang nak diproses → klik 🟢 **Senarai Pack**.
2. Buka helaian sedia cetak yang **kumpulkan semua item** dari order dipilih + **jumlah kuantiti**:
   - Setiap **variant dikira berasingan** (cth *Ceri Uzbekistan (1kg) ×30* dan *Ceri Uzbekistan (500g) ×20* = 2 baris berbeza).
   - Dipisah **❄️ Fresh (cold)** dan **📦 Dry** — sebab ditarik dari peti sejuk vs rak.
   - Setiap baris ada **☐ kotak tick** untuk operasi tanda bila siap tarik.
3. Guna senarai ni untuk **tarik stok sekali gus** sebelum pack — tak perlu kira order satu-satu.

> Beza dengan **Print AWB**: Senarai Pack = **jumlah keseluruhan** (berapa nak tarik). Print AWB = **slip per-order** (untuk pack & tampal pada bungkusan).

### 1.5 Cetak slip pek (Print AWB)

1. Tick order → **Print AWB**.
2. Setiap slip ada bahagian **ITEM senarai by-point** dengan **☐ kotak tick**.
   - **×N** hanya muncul bila pesan **2+ unit** baris itu. Kalau tiada `×`, maksudnya 1 unit.
   - Bilangan keping dalam satu unit rujuk **nama variant** (cth `(3 pack)`), bukan `×`.
3. **Packer wajib tick setiap item** semasa pack supaya tiada terlepas. Semak `ITEM (n)` = bilangan baris.

### 1.6 Selepas pack

- Tukar status order ke **Preparing** masa mula pack, dan **Dihantar** (`delivering`) bila dah serah ke kurier.

### 1.7 Order Pickup (Ambil Sendiri)

Customer boleh pilih **Ambil Sendiri** semasa checkout — pesanan diambil di kedai Bangi, **tiada caj penghantaran**, dan customer pilih **tarikh ambil**.

> Hidup/matikan pilihan ini di **Admin → Shipping** (toggle **Self-Collect (Pickup)**). Bila dimatikan, customer tak nampak pilihan pickup. Toggle ini kawal **checkout utama & landing page (LP)** sekali.
> Order LP pickup pun ada badge **PICKUP** (di senarai & detail order LP) dan ikut aliran status yang sama.

- Order pickup ada badge **PICKUP** (ungu) di halaman order + papar **tarikh ambil**.
- ⚠️ Order pickup **tidak muncul** dalam **Lalamove Grouping** & **Shipping Export** (tak perlu kurier/AWB).
- Aliran staf:
  1. Sedia pesanan → tukar status **Preparing**.
  2. Bila dah sedia untuk diambil → tukar status **Dihantar** (`delivering`). Customer auto dapat WA + push **"Sedia Diambil 🎉"** (bukan "Dalam Penghantaran").
  3. Bila customer dah ambil → tukar status **Delivered**.

---

## 2. Settelkan Order

### 2.1 Import tracking number (Ninja / Poslaju)

**Admin → Shipping → Export & Import**, tab **Import Tracking**

1. Dari portal kurier, download semula Excel/CSV (ada tracking number).
2. Format diterima: `order_number,carrier_id,tracking_number` (satu baris satu order). Klik **Muat turun template** untuk dapatkan fail contoh siap dengan tajuk lajur.
3. Pilih **Default Courier** (kalau CSV tak ada lajur carrier) — cth `ninja_cold`, `poslaju`, `lalamove`, `line_clear`.
4. Upload fail **CSV atau Excel (.xlsx)** — fail dari portal Poslaju/EasyParcel boleh terus upload tanpa tukar format — **atau** tampal data. Semak *preview* baris dikesan.
5. Klik **Import** → untuk setiap order yang padan, sistem auto:
   - simpan **no tracking** + **jana link tracking** (dari template carrier),
   - naik status order ke **Dihantar** (`delivering`, kalau masih confirmed/preparing),
   - **hantar WA + push + email** ke customer ("Dalam Penghantaran 🚚" + link).
6. Semak ringkasan **berjaya / gagal**. Baris gagal lazimnya sebab `order_number` tak padan — betulkan & import semula (import semula = ganti tracking lama, selamat).

> **Sokong order kedai (SYB-) & order LP (LP-) sekali.** Tampal kedua-dua jenis dalam satu fail pun boleh — sistem cari padanan dalam kedua-dua tempat secara automatik. Tak perlu asingkan.

> **Ninja/Poslaju vs Lalamove:**
> - **Ninja / Poslaju** bagi **nombor tracking** → masukkan nombor dalam lajur `tracking_number`. Sistem jana link tracking sendiri.
> - **Lalamove** tak bagi nombor — dia bagi **link share** je. Tampal **link penuh** (`https://...`) dalam lajur `tracking_number`, set carrier `lalamove`. Sistem kesan ia link → simpan sebagai **Link Penghantaran** dan WhatsApp customer hantar link tu terus. ✅ Boleh.

### 2.2 Tandakan order selesai

**Admin → Orders** → buka order → guna dropdown status:

| Bila | Set status ke |
|---|---|
| Mula pack | **Preparing** |
| Dah serah ke kurier / dalam perjalanan | **Dihantar** (`delivering`) |
| Customer dah terima | **Delivered** |

- Setiap perubahan **hantar push ke customer** (cth "Dalam Penghantaran 🚚", "Order Delivered 🎉"). Untuk order **pickup**, `delivering` papar **"Sedia Diambil 🎉"** (lihat 1.7).
- **Jangan** set `Delivered` sebelum betul-betul sampai (atau diambil, untuk pickup).
- Order COD: pastikan duit dah terima sebelum tutup.

---

## 3. Refund

**Admin → Refund** (`/admin/refunds`)

### 3.1 Cipta refund

1. Klik **Refund Baru**.
2. Cari & pilih **order** (no order / nama / telefon).
3. Pilih **item** yang nak direfund + kaedah kira:
   - **Per unit** — isi `rosak_qty` (bilangan unit rosak).
   - **Percentage** — isi `% rosak`.
   - Sistem kira jumlah refund automatik.
4. Pilih **Cara bayar balik**:
   - **Transfer** — isi maklumat bank customer.
   - **Baucar/Points** — kod promo dijana **bila status jadi Selesai** (boleh biar auto-jana atau taip kod sendiri).
   - **Ganti produk** — isi maklumat penghantaran ganti.
5. Isi sebab, PIC, kos/tuntutan supplier, muat naik **gambar bukti**, catatan.
6. **Simpan** → akauntan dapat **notifikasi WA** automatik. Deadline default **3 hari**.

### 3.2 Proses refund

Status refund: **`Pending` → `Dalam Proses` → `Selesai`**

- Kemaskini butiran di halaman **Edit** (PIC, bank, supplier, alamat ganti, dll).
- Order **overdue** (lepas deadline, belum selesai) ditanda merah dalam senarai.

#### Mengikut cara bayar:

**a) Transfer**
1. Buat pemindahan bank ke akaun customer.
2. Tukar status ke **Selesai**.

**b) Baucar**
1. Tukar status ke **Selesai**.
2. Sistem **jana kod promo sebenar** (nilai = jumlah refund, 1 kali guna, sah **90 hari**) — sekali sahaja (idempotent).
3. **Auto WA kod baucar ke customer** sebaik dijana.

**c) Ganti produk (replacement)**
1. Di halaman detail refund, isi **kurier + tracking** untuk shipment ganti.
2. Sistem cipta **shipment ganti** dalam modul shipping (berasingan dari shipment asal) + jana link tracking automatik.
3. Guna butang **WA tracking** untuk hantar maklumat penghantaran ke customer.
4. Tukar status ke **Selesai** bila dah hantar.

### 3.3 Lain-lain

- **WA customer** / **WA tracking** — butang di halaman detail untuk hubungi customer terus.
- **Analytics** — ringkasan refund.
- **Export** — muat turun rekod refund (CSV).

---

## 4. Quick Order — Team Sales

Untuk team sales yang ambil order customer melalui **WhatsApp / telefon**. Setiap order ditag pada nama anda supaya boleh dijejak siapa buat & berapa jualan.

### 4.1 Buat order untuk customer

**Admin → Quick Order** (`/admin/quick-order`)

1. **PILIH NAMA ANDA DULU** — dropdown **"Staff:"** (atas kanan kad Customer Details): **Muhd / Man / Pika / Far**, atau **"Lain-lain…"** untuk taip nama sendiri.
   > ⚠️ Wajib pilih nama — kalau tak, order tak tertag pada sesiapa dan anda tak dapat kredit jualan.
2. Isi **butiran customer**: Nama, Telefon, Email, Alamat penuh, Poskod.
3. (Pilihan) **Order untuk reseller** — pilih reseller kalau harga borong; atau biar "Bukan reseller".
4. Pilih **kaedah bayar**: Bank Transfer · Cash On Delivery (COD) · FPX (dah bayar) · E-Wallet (dah bayar).
5. **Tambah produk** — klik **Add Product**, cari & pilih produk + variasi + kuantiti.
6. (Pilihan) Isi **Notes** (arahan khas) & diskaun.
7. Klik **Create Order + Send WA** — order dicipta & mesej WhatsApp (pengesahan + bayaran) dihantar ke customer.

> Nama staf **kekal** untuk order seterusnya dalam sesi yang sama — tak perlu pilih balik setiap kali.

### 4.2 Tengok order anda

**Admin → Orders** (`/admin/orders`)

1. Pada bar penapis, guna dropdown **👤 Semua Staf** → pilih **nama anda** → senarai tunjuk **order anda sahaja**.
2. Setiap order anda ada badge kuning **"Manual · [nama]"** sebelah no. order.
3. Untuk tengok **semua order keyin manual** (semua staf), guna dropdown LP → **✍️ Keyin Manual**.
4. Boleh gabung dengan penapis **status** (Pending/Confirmed/dll), **tarikh**, dan **carian** nama/telefon.

### 4.3 Tengok jualan anda

1. Di **Orders**, pilih **nama anda** di dropdown 👤 Staf.
2. Pilih **tempoh** — dropdown tarikh (**Today / Yesterday / 7 Days / This Month**) atau julat **Dari–Hingga** + **Tapis Tarikh**.
3. **Bahagian atas senarai** papar ringkasan: **bilangan order** + **jumlah RM** — itulah **jualan anda** untuk penapis semasa.
4. (Pilihan) Tambah penapis bayaran **🟢 Sudah Bayar** untuk lihat jualan yang **dah dikutip** sahaja.

> **Contoh:** Pilih `Muhd` + `This Month` + `🟢 Sudah Bayar` → jumlah RM di atas = jualan Muhd yang dah dibayar bulan ini.

---

> Kemaskini SOP ini bila aliran sistem berubah. Lokasi: `docs/SOP-admin.md`.

## 5. LP Kurma di kurma.syababfresh.my — Team Sales

LP builder (Landing Pages) boleh dihidangkan di subdomain kurma. Sales tulis HTML sendiri; blok funnel gift box datang dari tag.

1. **Landing Pages → + Baru.** Isi Tajuk & Slug seperti biasa.
2. **Domain → pilih "Kurma".** URL jadi `kurma.syababfresh.my/lp/<slug>` (dipapar di bawah Slug). Pilih "Kedai" untuk LP produk biasa.
3. **Tekan "Isi contoh LP kurma"** untuk mula dari contoh (menu, hero, kalkulator, galeri, Studio, WhatsApp, footer), atau tulis HTML sendiri.
4. **Letak tag** di mana-mana dalam HTML (hover chip untuk penerangan):
   - `{{kurma:menu}}` menu kurma + WhatsApp (ganti header biasa LP)
   - `{{kurma:kira}}` kalkulator harga gift box (pelanggan dapat anggaran, hantar ke WhatsApp)
   - `{{kurma:wa|Teks butang}}` butang WhatsApp lead
   - `{{kurma:renders}}` strip design (render artwork klien, berlabel)
   - `{{kurma:galeri|8}}` foto kotak sebenar (nombor = bilangan)
   - `{{kurma:studio|Teks}}` butang ke Studio (letak logo, sebut harga)
   - `{{kurma:fab}}` butang WhatsApp terapung · `{{kurma:footer}}` footer kurma
5. **Tracking Ads:** Meta Pixel per LP seperti biasa. Lead WhatsApp dari tag direkod dengan angle `lp-<slug>` (CAPI), jadi setiap LP boleh dibanding.
6. **Simpan & Kongsi:** butang salin/WhatsApp di senarai dah bagi URL kurma. Lencana "Kurma" tanda LP di subdomain.

Nota: LP ini untuk **gift box custom** (sebut harga). Untuk jual kurma runcit/karton dengan checkout, pilih Domain "Kedai" dan guna `{{checkout:...}}` seperti biasa.

## 6. Gift Kurma — Sebut Harga, Pipeline & Invois (Team Sales)

Aliran penuh satu deal: **WhatsApp → Sebut harga → klien minta invois → Convert to Invoice → Deposit → Artwork OK → Produksi → Dihantar → Baki dibayar → Selesai.** Semua di admin; Refrens hanya untuk e-Invois LHDN & akaun.

### 6.1 Buat sebut harga
1. **Sebut Harga → Sebut harga baharu.** (Dari enquiry web: **Enquiry Gift → Buat sebut harga**, borang terisi.)
2. **Quotation For → Select a Client.** Taip nama/syarikat/telefon — klien lama (termasuk dari Refrens, bertanda) akan keluar. Tiada? **Add New Client**, isi syarikat, PIC, **telefon atau email** (wajib salah satu), alamat; SSM & TIN jika ada.
3. **Tarikh perlu hantar** — tanya klien bila perlu barang (lead time cetak ±2 minggu). Dicetak "Required delivery" pada PDF & memacu peringatan.
4. **Item** — taip nama, pilih dari cadangan katalog (harga semasa terisi) atau tulis sendiri (cth. Transportation). Add Description untuk gred/asal. Diskaun & caj tambahan di kanan.
5. **Save As Draft** = simpan sahaja. **Save & Continue** = **keluarkan**: nombor **STSB2026…** diberi dari siri Refrens, salinan dicipta di Refrens, dan **deal lahir di Pipeline Gift**. Draf tidak masuk pipeline.

### 6.2 Hantar kepada klien
- **PDF** (muat turun / WhatsApp), **Email** (PDF + pautan), atau **Share link**: klien buka pautan, lihat, muat turun PDF, dan tekan **Accept**. Penerimaan direkod pada deal (lencana "Accepted").

### 6.3 Klien setuju & minta invois
1. Buka sebut harga → **Convert to Invoice** → sahkan. Invois dicipta terus di Refrens (nombor siri Refrens), PDF & pautan klien dipapar. Deal pindah ke **Invois**.
2. Isi **No. PO/LO** klien (korporat/kerajaan) dalam panel deal.
3. Perlu invois tanpa sebut harga (jualan terus)? **Invois Refrens → Cipta invois**.

### 6.4 Deposit masuk (bank transfer)
1. **Pipeline Gift** → buka deal → **Tanda deposit dibayar**: jumlah (terisi), tarikh, kaedah *Pindahan bank*, rujukan dari resit.
2. Biar **"Rekod juga pada invois Refrens"** bertanda — status invois Refrens ikut bertukar, tiada kerja dua kali.
3. Deposit % lalai 50; set **0%** untuk klien yang bayar penuh selepas hantar (tender/LO).

### 6.5 Artwork → Produksi → Dihantar → Baki
- **Artwork OK**: tanda tarikh + nama pengesah + pautan mockup akhir **sebelum** cetak (gate wajib — elak pertikaian warna/logo).
- **PIC pack** (siapa siapkan pek): sebaik **deposit masuk**, buka panel deal → seksyen **PIC pack** → pilih staf (atau tekan **Saya**) → tulis **arahan pek** (kuantiti, isi, finishing, label, susunan karton) → Simpan. PIC dapat notifikasi push dan nampak semua tugasannya di penapis **Tugasan pack saya**. Kad bertanda amaran *PIC pack belum ditetapkan* selagi kosong. Bila pek siap, PIC tekan **Tanda pek siap hari ini** (lencana *Pek siap* pada kad) — barulah tanda Dihantar.
- **Produksi**: isi sasaran siap; tukar peringkat ke Produksi.
- **Dihantar**: tarikh, cara (Lalamove/kurier/ambil), tracking, nama penerima, **pautan foto bukti terima**.
- **Baki**: **Tanda baki dibayar** → deal **Selesai** automatik. Batal/kalah → peringkat *Batal / Kalah* + sebab.

### 6.6 Peraturan harian
- Setiap deal mesti ada **Tindakan seterusnya + tarikh**. Kad bertanda amaran bila: tiada respons 3 hari, hampir luput, deposit belum masuk, artwork belum OK < 14 hari, lewat hantar, baki tertunggak 7/14 hari.
- Deal milik **sales yang keluarkan sebut harga** (boleh tukar di panel). Guna **akaun admin sendiri** — jangan kongsi akaun. Penapis **Deal saya** di Pipeline.
- **Sales ≠ PIC pack.** Sales jaga klien & bayaran; PIC pack jaga pek siap ikut *Tarikh perlu hantar*. Satu deal, satu PIC pack. Sales yang tetapkan PIC (atau PIC tugaskan diri sendiri).
- Jangan keluarkan sebut harga ujian — nombor Refrens terpakai. Jangan edit kandungan invois di website — buka di Refrens. Cari klien dulu sebelum Add New Client.

### 6.7 Harga & kos dari Sheet "GIFT BOX CUSTOM 2026"
Sumber harga gift box ialah Google Sheet, tab **GIFT BOX CUSTOM 2026**. Website tak simpan harga sendiri; ia salin dari Sheet bila ditarik.

**Bila harga/kos berubah (orang yang jaga Sheet):**
1. Ubah angka di Sheet seperti biasa (kos kurma, kos kotak ikut kuantiti, harga). Jangan ubah nama lajur atau tajuk "Jenis Kurma" — itu yang sistem cari.
2. **Kos & Harga → Tarik dari Sheet.** Mesej tunjuk berapa baris baharu/berubah. Selesai — tiada benda lain perlu ditaip.
3. Pastikan Sheet kekal dikongsi "sesiapa dengan pautan boleh lihat"; kalau tidak, butang akan beri ralat.

**Bila buat sebut harga (team sales):**
1. Dalam baris item, taip nama kurma (cth. `mariami`) atau `gift box`.
2. Pilih cadangan **"Custom Gift Box 200g — Mariami A"** (bertanda *Sheet gift 2026*). Harga tier 500 terisi; harga tier 1,000 dan 2,000 serta kos & margin tertera dalam keterangan.
3. Tukar **Quantity** ikut pesanan klien dan **laraskan kadar ikut tier** (cth. 1,000 kotak → guna harga @1,000). Ikut panduan margin sasaran di atas jadual (100–300 pcs 50–55%, 300–1,000 45–50%, 1,000–5,000 40–45%).
4. Harga akhir untuk klien ialah keputusan sales — Sheet ialah rujukan kos & margin, bukan harga wajib.

**Kalkulator harga (main margin tanpa buka Sheet):** dalam sebut harga, buka **Kalkulator harga gift box** (atas jadual item) atau di **Kos & Harga**. Pilih kurma, berat, kuantiti → nampak kos/kotak & harga Sheet ikut tier. Taip **Margin sasaran %** (cth. 20) → harga baharu dikira; atau taip **Harga anda** → margin dikira. Nampak untung/kotak, jumlah untung & jumlah jualan, dan amaran bila margin bawah panduan. **Tambah ke item** masukkan terus ke sebut harga dengan kuantiti & harga itu. **Pecahan kos** (Kos Kurma, Ziplock, Upah, Lain-Lain, Kotak, Komisyen) dipapar dengan nilai Sheet dan boleh diubah untuk cuba senario — contoh kotak lebih murah — kos, harga & margin dikira semula; **Ikut Sheet** set balik.

---

## 7. AI Chatbot WhatsApp — Pengetahuan buah

AI hanya tahu apa yang ada dalam **katalog** (nama, penerangan, saiz, harga, stok live) dan **kad fakta yang disahkan**. Kalau customer tanya sesuatu yang tiada, AI akan jujur kata tak pasti dan tawar semak dengan team.

### 7.1 Kad fakta produk (CRM → AI Chatbot → Pengetahuan buah)
1. Tekan **Jana draf AI** — AI isi kad fakta (asal, musim, rasa, tekstur, biji, cara simpan, tempoh tahan, tanda masak, cara makan, beza gred, nota kesihatan, soalan lazim) dari penerangan produk. Status **Draf** — AI chatbot BELUM guna.
2. Buka produk, **baca setiap medan**, betulkan yang salah atau kosongkan yang tak pasti. Jangan tulis harga di sini (harga datang dari katalog).
3. Tekan **Simpan & sahkan** → status **Disahkan** → AI mula guna. Nama anda direkod sebagai pengesah.
4. Produk berubah (gred baharu, asal lain)? Buka kad, edit, Simpan. Fakta yang meragukan: **Batal pengesahan** dulu.

### 7.2 FAQ umum (tab FAQ umum)
Soalan yang kerap ditanya tanpa kaitan satu produk (polisi buah rosak, cara simpan kurma, tempoh hantar). Tulis soalan + jawapan, tanda **Aktif**. AI guna terus. Promosi semasa & nota sementara kekal di **Config → Nota & fakta tambahan**; kemas kini bila promo tamat supaya AI tak bercanggah.

### 7.3 Gift box kurma & kurma borong dalam chatbot
AI tahu kita buat **custom gift box kurma** (min 50 kotak, design percuma, deposit 50%, ~2 minggu) dan **kurma borong**. Ia beri **anggaran** harga dari kalkulator Studio, kumpul butiran (syarikat, kuantiti, kurma, tarikh, kawasan, logo) dan rekod ke **Enquiry Gift** (badge *WhatsApp AI*) — team sales dapat push, buka enquiry → **Buat sebut harga** seperti biasa. AI tidak ambil deposit dan tidak janji tarikh siap.

### 7.4 Ujian & soalan tak pasti
- **Playground → tab Ujian**: tekan **Jalankan semua**. Setiap soalan sebenar customer disemak automatik (tool betul, frasa wajib ada, frasa dilarang tiada) dan diberi skor penilai AI 0–2. Gagal? Buka baris, baca balasan, betulkan fakta/FAQ atau nota, ulang **yang gagal sahaja**. Jalankan selepas setiap perubahan besar pada pengetahuan atau persona.
- **Analytics → Soalan tak pasti**: senarai soalan sebenar yang AI jawab tapi mengaku tak tahu atau produk tiada. Inilah senarai kerja: tambah kad fakta produk atau FAQ umum, atau beritahu pemilik produk itu patut diaktifkan.

### 7.5 Peraturan
- Jangan sahkan draf tanpa baca. AI boleh tersilap asal negara atau gred.
- Nota kesihatan: umum sahaja (gula, serat). Tiada dakwaan ubat.
- Uji di **Playground** selepas sahkan: tanya macam customer, pastikan jawapan ikut kad.
