-- ============================================================
-- 142_lp_order_meta_attribution.sql — Atribusi Meta untuk order LP (13 Okt 2026)
--
-- MASALAH: Meta tak detect conversion untuk order COD. Order COD LP tak pernah
-- tembak Purchase (tiada pixel — kad inline tak navigasi; tiada CAPI — hanya
-- diwire ke jadual `orders`). Kita tembak CAPI Purchase bila COD DILULUSKAN
-- (order jadi "real"). CAPI itu ditembak KEMUDIAN (aksi admin), jadi isyarat
-- padanan Meta (_fbc/_fbp cookie + user-agent) mesti DISIMPAN masa order dibuat.
-- client_ip sudah disimpan sebelum ni.
--
-- PENYELESAIAN: 3 lajur nullable untuk atribusi. Diisi di laluan cipta order LP;
-- dibaca semula di laluan kelulusan COD → sendCapiPurchase (match quality lebih baik).
--
-- Additive. Idempotent — selamat dijalankan semula.
-- ============================================================

alter table public.lp_guest_orders
  add column if not exists fbc text,
  add column if not exists fbp text,
  add column if not exists user_agent text;

comment on column public.lp_guest_orders.fbc is 'Meta click-id cookie (_fbc) masa order dibuat — untuk CAPI match quality.';
comment on column public.lp_guest_orders.fbp is 'Meta browser-id cookie (_fbp) masa order dibuat — untuk CAPI match quality.';
comment on column public.lp_guest_orders.user_agent is 'User-agent pelayar masa order dibuat — untuk CAPI match quality.';
