# Pelan: Butang "Minta Refund" (customer → admin review)

**Status:** DITANGGUH — dirangka 2026-07-03, belum dibina. Bina bila ready.

## Konsep
Customer tekan **Minta Refund** pada order → pilih sebab + tulis penerangan + upload
bukti gambar → jadi satu `support_complaints` (jenis `refund`) → admin review gambar →
tukar jadi **refund rasmi** (guna sistem `refunds` sedia ada yang dah auto-WhatsApp
customer + jana baucar).

## Keputusan reka bentuk (dipilih user)
- **Seni bina:** guna semula `support_complaints` (BUKAN table baru).
- **Kelayakan:** sah **24 jam** selepas order sampai (`delivered`).
- **Pengguna:** Member + Guest/LP kedua-dua.

## Infrastruktur sedia ada (guna semula)
- `supabase/071_support_complaints.sql` — `support_complaints`: `order_kind (store|lp)`,
  `order_id`, `order_number`, customer contact, `category (rosak|hilang|lambat|salah_item|
  soalan|lain)`, `status (open|escalated|resolved|closed|rejected)`, `image_urls text[]`,
  `resolution_type`, `refund_id` (link ke refunds), + thread `support_messages`. RLS
  service-role sahaja; customer akses via token HMAC.
- Sistem refund penuh (admin): `supabase/054_refunds.sql` + `075_refund_lp_order.sql`
  (sokong `order_id` storefront DAN `lp_order_id`). Status `pending|processing|selesai`.
  Bila `baucar` → `selesai`, auto-jana `promo_codes` + WhatsApp kod ke customer
  (`api/admin/refunds/[id]/route.ts`).
- Upload bukti (customer, token-gated): `api/support/upload/route.ts` → bucket
  `brand-assets` (public, `supabase/031_brand_assets_bucket.sql`). Compress WebP
  sisi-klien: `src/components/admin/image-uploader.tsx` (`resizeToWebp`).
- Order pages: `src/app/orders/page.tsx` (senarai, merge orders + lp_guest_orders ikut
  email/phone), `src/app/orders/[id]/page.tsx` (member detail, auth `user_id`),
  `src/app/resit/[id]/page.tsx` (guest/LP detail, phone). Status label:
  `src/app/orders/status.ts`. Delivered ditetapkan oleh `api/cron/auto-deliver`
  (delivering→delivered selepas N hari, default 7) / Lalamove webhook / admin manual.

## Fasa 1 — DB (kecil, additive)
- Migration `103`: `alter table support_complaints add column if not exists request_type text;`
  (tanda `'refund'` vs aduan biasa → admin boleh tapis).
- `app_settings`: `refund_request_window_hours = '24'` (boleh laras admin).
- **Tiada table baru.**

## Fasa 2 — Customer submit (storefront)
- **Kelayakan (server-side):** `status='delivered'` DAN `now − delivered_at ≤ 24 jam`
  DAN belum ada permintaan refund terbuka untuk order itu.
- **Butang "Minta Refund"** di `/orders/[id]` (member, auth session) + `/resit/[id]`
  (guest/LP, phone/token corak `api/support`).
- **Borang:** sebab (`rosak|salah_item|kurang|hilang|lain`) + penerangan + upload 2–6
  gambar (WebP compress sisi-klien → `brand-assets` bawah `refund-requests/{id}/`).
- **API `POST /api/store/refund-request`:** sahkan kelayakan + pemilikan order → cipta
  `support_complaints(request_type='refund', category, image_urls, order info)` +
  `support_messages` (penerangan) → notify admin (WhatsApp, macam refund POST).
- Selepas hantar: order papar *"Permintaan refund dihantar — admin akan semak"*.

## Fasa 3 — Admin review
- **Queue** `/admin/refund-requests` (+ badge kiraan di nav): senarai `request_type='refund'`
  — order, sebab, gambar bukti, customer.
- **Tindakan:**
  - **"Cipta Refund"** → buka `/admin/refunds/new` prefill order → flow refund sedia ada
    (auto baucar/WhatsApp) → set `complaint.refund_id` + status `resolved`.
  - **"Tolak"** → status `rejected` + nota (boleh WA customer sebab).

## Fasa 4 — (kemudian, optional)
- Customer nampak status permintaan (terbuka/lulus/tolak) pada order.
- Notify customer bila diputuskan (WA/email).

## Nota & risiko
1. **`delivered_at` kadang lewat** — auto-deliver cron tanda delivered 7 hari selepas
   "delivering". Tingkap 24 jam bermula dari cap masa itu (lewat tapi OK). Lalamove
   webhook / admin manual beri cap masa tepat.
2. **24 jam ketat** — sesuai untuk buah (aduan segar mesti segera). Papar jelas
   *"Sah 24 jam selepas terima"*.
3. **Keselamatan guest** — re-verify phone betul-betul milik order LP (corak token support).
4. **Anti-abuse** — 1 permintaan terbuka per order; `abuse_flag` sedia ada.
