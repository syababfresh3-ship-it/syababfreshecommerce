-- ============================================================
-- 141_variant_free_shipping.sql — Free shipping per-variasi (13 Okt 2026)
--
-- MASALAH: free shipping kini HANYA dicetus jumlah basket (app_settings
-- .free_delivery_min, kini RM189). Sales nak variasi tertentu (cth Figs 1.5kg)
-- layak penghantaran percuma secara automatik tanpa kira jumlah.
--
-- PENYELESAIAN: bendera boolean per-variasi (ikut corak 106_product_is_cold).
-- Kiraan fee (server authoritative, 4 laluan order) tambah cabang: kalau MANA-
-- MANA baris troli ada variasi free_shipping → deliveryFee = 0 (shipping dikira
-- per-order, jadi seluruh order jadi percuma). Admin on/off di variant-manager.
--
-- Additive. Idempotent — selamat dijalankan semula.
-- ============================================================

alter table public.product_variants
  add column if not exists free_shipping boolean not null default false;

comment on column public.product_variants.free_shipping is
  'true = variasi ini layak penghantaran percuma automatik (abai had basket). Jika ada dalam troli, seluruh order free shipping.';
