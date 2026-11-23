# Program Affiliate — produk-link, klik pelayan, tahan 7 hari

Status: **DIBINA 23 Nov 2026, belum commit. Migration 165 belum dijalankan di production.**
Keputusan pemilik (23 Nov): kadar komisen ikut produk · tempoh tahan 7 hari · pautan LP ditangkap.

## Model

| Perkara | Nilai | Di mana |
|---|---|---|
| Kadar komisen | per produk, `products.affiliate_pct` (0..1) | Admin → Products → "Komisen Affiliate (%)" |
| Pautan | `?aff=KOD` pada mana-mana laluan: `/products/<slug>`, `/lp/<slug>`, `/` | `components/affiliate/affiliate-capture.tsx` (root layout) |
| Klik | direkod pelayan → `affiliate_clicks` (id klik disimpan di localStorage `sf_aff`) | `POST /api/affiliate/click` |
| Tetingkap | 30 hari dari masa klik **di pelayan** (`affiliate_window_days`) | `lib/affiliate-stamp.ts` |
| Attribution | last-click; skop produk → LP → seluruh kedai (`*`) | `lib/affiliate-attribution.ts` |
| Asas komisen | harga baris **bersih** diskaun promo/flash/mata, tanpa penghantaran (`line_subtotal`; kasar di `line_gross`) | `lib/affiliate-stamp.ts` |
| Beli sendiri | akaun sama ATAU telefon sama (guest/LP) → tidak dikira | `lib/affiliate-stamp.ts` |
| Tahan | delivered+dibayar → `credit_after = now + affiliate_hold_days` (7) | `order-delivered.ts` → RPC `affiliate_schedule_credit` |
| Kredit | cron setiap jam (`vercel.json`, minit 20) → RPC `affiliate_credit_due` (semak semula order & affiliate; void yang batal) | `/api/cron/affiliate-credit` |
| Reversal | refund/batal → RPC `affiliate_reverse_order` (credited → tolak baki; pending → batal) | admin orders & LP orders PATCH |
| Pengeluaran | RPC atomik `affiliate_request_withdrawal`; mesin keadaan `affiliate_withdrawal_set_status` | `/api/affiliate/withdraw`, `/api/admin/affiliates/withdrawals/[id]` |
| Minimum keluar | `affiliate_min_withdraw` (10) | Admin → Affiliate → Tetapan |
| WA kepada affiliate | `affiliate_notify_wa` on/off (lalai **off**) | cron kredit, bayar/tolak pengeluaran |

## Keselamatan yang ditampal (migration 165)

1. `profiles`: trigger `trg_protect_profile_cols` — ahli tak boleh ubah `is_admin`, `is_affiliate`, `affiliate_balance`, `referral_code` sendiri (nilai lama dikekalkan senyap; admin & service role bebas).
2. `affiliate_withdrawals`: polisi INSERT terbuka dibuang.
3. `affiliate_invites`: polisi SELECT umum dibuang.
4. RPC `increment_affiliate_balance`, `increment_points`, `increment_spend`: EXECUTE ditarik daripada anon/authenticated (dulu sesiapa yang log masuk boleh naikkan mata/baki sendiri via PostgREST). Semua pemanggil memang service role.
5. `affiliate_applications`: unik hanya untuk `pending` (boleh mohon semula selepas ditolak).
6. `products.affiliate_pct` check 0..1 + dihadkan di API admin.

## Fail

- Migration: `supabase/165_affiliate_hardening.sql` (idempoten; diuji 2× pada Neon dengan stub skema — T1–T9 lulus).
- Klien: `lib/affiliate-attribution.ts`, `components/affiliate/affiliate-capture.tsx` (root layout), `stores/cart.ts` (`affClick`), `checkout/page.tsx`, 3 borang LP (`lp-cart-bar`, `lp-multi-checkout`, `lp-inline-checkout` hantar `aff`).
- Pelayan: `lib/affiliate-stamp.ts`, `api/orders`, `api/store/guest-order`, `api/lp/[slug]/order` (cap attribution), `lib/order-delivered.ts` (jadual/reversal), `api/cron/affiliate-credit`, `api/affiliate/click`, `api/affiliate/withdraw`, `api/admin/affiliates/withdrawals/[id]`, `api/admin/products` (clamp).
- UI: `/affiliate` (page + `affiliate-dashboard.tsx`, Melayu, monokrom), `/admin/affiliates` (page + client), nav admin MARKETING → Affiliate.
- `src/app/products/[slug]/affiliate-capture.tsx` kini shim kosong (tangkapan pindah ke root) — boleh dipadam.

## Langkah pemilik

1. Jalankan `supabase/165_affiliate_hardening.sql` di Supabase SQL editor (production). Sebelum itu kod sudah tahan: stamp jatuh balik ke lajur lama, kredit tak dijadualkan (baris kekal pending, tiada komisen hilang).
2. `commit dan push` → Vercel daftar cron `affiliate-credit` dari `vercel.json`.
3. Set kadar pada produk yang mahu dipromosi (5 produk sudah ada kadar > 0).
4. Ujian: buka `/products/<slug>?aff=<KOD>` → semak baris `affiliate_clicks`; buat order ujian → baris `affiliate_attributions` pending; tanda delivered → `credit_after` terisi; cron/RPC kredit selepas 7 hari (untuk ujian, set `affiliate_hold_days` = 0 sementara).

## Belum / susulan

- `/jadi-affiliate` (halaman jemputan) masih gaya lama (ungu) — belum disentuh.
- Penyata bulanan / eksport untuk affiliate; notifikasi dalam app.
- Cawangan Neon `aff-mig-test` (projek syababfresh) dicipta untuk ujian SQL — padam bila selesai.
