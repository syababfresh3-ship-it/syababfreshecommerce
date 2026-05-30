# SOP Admin — SyababFresh

Rujukan operasi harian untuk admin/staf. Tiga bahagian:
1. [Keluarkan Order](#1-keluarkan-order) — pack & hantar
2. [Settelkan Order](#2-settelkan-order) — import tracking & tutup order
3. [Refund](#3-refund)

> **Status order** (ikut sistem):
> `pending` → `confirmed` → `preparing` → `delivering` (customer nampak **"Dihantar"**, detail **"Dalam Penghantaran"**) → `delivered`.
> Lain: `cancelled`, `refunded`. **Setiap tukar status hantar push notification ke customer** — jadi jangan tukar sembarangan.

---

## 1. Keluarkan Order

### 1.1 Tentukan kurier (rujukan pantas)

Sistem cadang kurier automatik di **Admin → Shipping → Export & Import** (lajur *Courier*):

| Jenis item | Kawasan | Kurier | Cara keluarkan |
|---|---|---|---|
| Fresh (sejuk) | **LK** (Lembah Klang) | **Lalamove** (same-day) | Lalamove Grouping |
| Fresh (sejuk) | **Pos** (luar LK) | **Ninja Cold** | Export Ninja Cold CSV |
| Dry sahaja | mana-mana | **Poslaju** | Export Poslaju CSV |
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

### 1.3 Order Ninja Cold / Poslaju — CSV

**Admin → Shipping → Export & Import** (`/admin/shipping/exports`), tab **Export & Print**

1. Pilih julat tarikh (**From / To**) → **Filter**.
2. Guna **chip filter kawasan** untuk asingkan: **Semua / LK / Pos / Lain-lain** (ada kiraan setiap satu).
3. Klik **Select All** (hanya tick order dalam filter semasa) atau tick manual. Pilihan kekal walau tukar filter.
4. Generate ikut kurier:
   - **Pos** (fresh, luar LK) → **Ninja Cold CSV**
   - **Dry** → **Poslaju CSV**
5. Upload CSV ke portal kurier (Ninja / EasyParcel) → portal jana AWB + tracking number.

> Alamat tak lengkap = baris kelabu + amaran. Betulkan order dulu sebelum export.

### 1.4 Cetak slip pek (Print AWB)

1. Tick order → **Print AWB**.
2. Setiap slip ada bahagian **ITEM senarai by-point** dengan **☐ kotak tick**.
   - **×N** hanya muncul bila pesan **2+ unit** baris itu. Kalau tiada `×`, maksudnya 1 unit.
   - Bilangan keping dalam satu unit rujuk **nama variant** (cth `(3 pack)`), bukan `×`.
3. **Packer wajib tick setiap item** semasa pack supaya tiada terlepas. Semak `ITEM (n)` = bilangan baris.

### 1.5 Selepas pack

- Tukar status order ke **Preparing** masa mula pack, dan **Dihantar** (`delivering`) bila dah serah ke kurier.

### 1.6 Order Pickup (Ambil Sendiri)

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
2. Format diterima: `order_number,carrier_id,tracking_number` (satu baris satu order).
3. Pilih **Default Courier** (kalau CSV tak ada lajur carrier).
4. Upload fail **atau** tampal data → semak *preview* baris dikesan.
5. Klik **Import** → untuk setiap order yang padan, sistem auto:
   - simpan **no tracking** + **jana link tracking** (dari template carrier),
   - naik status order ke **Dihantar** (`delivering`, kalau masih confirmed/preparing),
   - **hantar WA + push + email** ke customer ("Dalam Penghantaran 🚚" + link).
6. Semak ringkasan **berjaya / gagal**. Baris gagal lazimnya sebab `order_number` tak padan — betulkan & import semula (import semula = ganti tracking lama, selamat).

### 2.2 Tandakan order selesai

**Admin → Orders** → buka order → guna dropdown status:

| Bila | Set status ke |
|---|---|
| Mula pack | **Preparing** |
| Dah serah ke kurier / dalam perjalanan | **Dihantar** (`delivering`) |
| Customer dah terima | **Delivered** |

- Setiap perubahan **hantar push ke customer** (cth "Dalam Penghantaran 🚚", "Order Delivered 🎉"). Untuk order **pickup**, `delivering` papar **"Sedia Diambil 🎉"** (lihat 1.6).
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

> Kemaskini SOP ini bila aliran sistem berubah. Lokasi: `docs/SOP-admin.md`.
