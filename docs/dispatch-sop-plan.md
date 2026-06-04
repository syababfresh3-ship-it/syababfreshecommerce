# Plan: SOP Dispatch — Barcode Scan-Out + Gambar Bukti

> Status: **DIRANGKA** (belum mula kod). Dikemas 2026-06-04.
> Tujuan: track setiap order **keluar** (scan-out) + simpan gambar bukti sebelum
> rider ambil — untuk bukti barang hilang & claim Lalamove (mereka perlu gambar).

## 1. Objektif
Setiap parcel di-scan keluar + difoto dalam app, auto-link ke order + timestamp +
staff. Hasilkan rekod dispatch yang boleh search bila ada pertikaian/claim.

## 2. Keputusan yang dah disetujui
- **Scan: dua-dua cara**
  - Scanner fizikal (HID keyboard) — tak perlu library, terus jadi input + Enter.
  - Kamera telefon — perlu `html5-qrcode` (atau `BarcodeDetector` native).
- **Barcode AWB: Code128** (1D — boleh scan handheld + kamera). Bukan QR.
- **Gambar bukti:** snap & upload **dalam app** per order → Supabase Storage
  (`brand-assets/dispatch/`), auto-link order + timestamp + staff.

## 3. Fasa pelaksanaan

### Fasa 1 — Barcode pada AWB
- Tambah barcode **Code128** pada AWB (no order / tracking).
- Add-on label: tag kurier + zon (guna `is_kl` + `getZone`), tarikh (`created_at`),
  label segar (`has_fresh`).
- Dependency: `jsbarcode`.
- File: `src/app/admin/shipping/exports/exports-client.tsx` → fungsi `printAwb`.
- Nota: AWB footer "Dari:" dah dialih ke bawah (siap).

### Fasa 2 — Skrin dispatch (scan-out + foto)
- Route baru `/admin/shipping/dispatch` (mobile-first).
- Input fokus tangkap scanner → Enter → lookup `order_number` (cari `orders` +
  `lp_guest_orders`).
- Butang kamera (`html5-qrcode`) untuk scan guna telefon.
- Bila jumpa order → snap gambar → upload → rekod dispatch + set status `delivering`.
- **Migration baru** `order_dispatches`:
  ```
  order_dispatches
    id, order_id, source ('store'|'lp'), order_number,
    scanned_at, scanned_by, courier, photo_url, notes
  ```
  > ⚠️ Memory asal sebut migration `069`, TAPI 069 (`wa_outbox`) & 070
  > (`lp_delivering_at`) sudah dipakai. Guna nombor seterusnya yang kosong
  > (cth `072+`, selepas `071_support_complaints` kalau AI support dibuat dulu).
  > Sahkan `ls supabase/` sebelum cipta.
- API: `POST /api/admin/shipping/dispatch`.

### Fasa 3 — Log dispatch / bukti claim
- Senarai dispatch + thumbnail gambar + masa + staff.
- Search ikut no order — untuk tarik bukti bila ada claim hilang/Lalamove.

## 4. Reuse infra sedia ada
- Upload gambar: ikut pattern `src/app/api/admin/refunds/upload` (Supabase Storage).
- Zon/kurier: `is_kl` + `getZone` (lalamove-grouping `zone-config.ts`).
- Set status `delivering` masa scan-out → konsisten dgn flow order
  (`delivering_at` diset; lihat juga cron auto-deliver).

## 5. Kaitan dengan kerja lain
- Saling lengkap dengan **bulk tracking import** & **AWB export** (lihat
  `project_upcoming_features` memory).
- Status `delivering` yang diset di sini akan ditangkap oleh cron **auto-deliver**
  (auto → `delivered` selepas N hari).
