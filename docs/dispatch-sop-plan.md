# Plan: SOP Dispatch — Barcode Scan-Out + Reconcile Stok Keluar

> Status: **FASA 1 SIAP** (barcode AWB). Fasa 2 & 3 belum. Dikemas 2026-06-07.
> Tujuan utama: bezakan order yang **tracking dah assign** vs **barang betul-betul
> keluar fizikal** — supaya admin tahu yang mana masih tersangkut dalam warehouse
> (customer nampak "pending pickup" tapi tak tahu sama ada barang dah keluar).

## 1. Objektif (Option B — visibility/reconcile)
Scan setiap parcel masa keluar → rekod "barang dah keluar fizikal" + siapa/bila.
Bukan untuk tolak stok (stok **dah ditolak masa bayaran disahkan** —
`order-confirm.ts` `deduct_inventory`/`deduct_variant_stock`; restore bila cancel
migration 023). Scan = **lapisan pengesahan + reconcile**, JANGAN tolak stok lagi
(elak double-deduct).

Aliran kekal: import tracking pagi → blast ke customer (macam sekarang). Scan
cuma tambah visibility — TIDAK gate notifikasi customer (workflow batch pagi).

## 2. Keputusan yang dah disetujui
- **Scan: dua-dua cara** — scanner fizikal (HID keyboard, no lib) + kamera telefon (`html5-qrcode`).
- **Barcode AWB: Code128** (encode `order_number`). Bukan QR.
- **Gambar bukti: scan-sahaja dulu** (laju untuk batch pagi). Kolum `photo_url`
  dikekalkan dalam DB supaya boleh hidupkan kemudian tanpa migration lagi.
- **Stok: tak diubah** — scan tak sentuh nombor stok.

## 3. Fasa pelaksanaan

### ✅ Fasa 1 — Barcode pada AWB (SIAP 2026-06-07)
- Code128 (encode `order_number`) ditambah pada slip AWB, di atas selepas header.
- Dependency: `jsbarcode` + `@types/jsbarcode` (terpasang).
- File: `src/app/admin/shipping/exports/exports-client.tsx` → `printAwb` (kini async,
  lazy-load jsbarcode, fallback tiada-barcode kalau gagal load).
- CSS `.barcode` compact (9mm) supaya kekal 1 page A6. Data/layout lain TAK diubah.

### ⏳ Fasa 2 — Skrin scan-out `/admin/shipping/dispatch` (mobile-first)
- Input fokus tangkap scanner HID → Enter → lookup `order_number` (`orders` + `lp_guest_orders`).
- Butang kamera (`html5-qrcode`) backup.
- Jumpa order → rekod dispatch (scan-sahaja). Set status `delivering` kalau belum.
- **Migration `074`** `order_dispatches`:
  ```
  order_dispatches
    id, order_id, source ('shop'|'lp'), order_number,
    scanned_at, scanned_by, courier, photo_url (nullable), notes
  ```
  > Sahkan `ls supabase/` dulu — terkini 073, jadi guna 074.
- API: `POST /api/admin/shipping/dispatch`.

### ⏳ Fasa 3 — Paparan dispatch (reconcile harian)
1. **Ikut kurier**: patut keluar │ dah scan │ belum (hari ni) — Lalamove/Pos/Ninja.
   - patut keluar = `delivering` dgn `delivering_at` hari ni, group ikut kurier.
   - dah scan = ada `order_dispatches` hari ni. belum = beza.
2. **Ikut produk**: total kuantiti tiap jenis buah yang dah keluar (dari `order_items`).
3. **Tertunggak**: order `delivering` hari lepas yang BELUM discan keluar (elak tercicir).

## 4. Reuse infra sedia ada
- Upload gambar (bila diaktifkan): pattern `src/app/api/admin/refunds/upload`.
- Set status `delivering` masa scan → konsisten dgn flow (`delivering_at`; cron auto-deliver).

## 5. Kaitan dengan kerja lain
- Saling lengkap dgn **bulk tracking import** & **AWB export**.
- `delivering` yang diset di sini ditangkap cron **auto-deliver** (→ `delivered` selepas N hari).
