-- ============================================================
-- 116_payment_methods_chip.sql
-- Tambah kaedah bayaran baru yang diluluskan CHIP: Kad Kredit/Debit, DuitNow,
-- FPX B2B (perniagaan). Muncul di /admin/payments untuk di-toggle.
--
-- Whitelist CHIP (disahkan terhadap API live): card→visa+mastercard,
-- duitnow→duitnow_qr, fpx_b2b→fpx_b2b1. Peta di src/lib/chip-methods.ts.
--
-- is_active = FALSE (default) — SELAMAT dijalankan bila-bila, walau sebelum kod
-- deploy: kaedah tak muncul di checkout sampai admin toggle ON. Elak customer
-- pilih kaedah baru sebelum routing/whitelist kod live.
--
-- Turutan selamat: (1) deploy kod, (2) jalankan migrasi ini, (3) toggle ON di
-- /admin/payments.
--
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

insert into public.payment_methods (id, label, sublabel, is_active, sort_order) values
  ('card',    'Kad Kredit/Debit', 'Visa · Mastercard',        false, 1),
  ('duitnow', 'DuitNow QR',       'Imbas & bayar',            false, 2),
  ('fpx_b2b', 'FPX Perniagaan',   'Akaun bank perniagaan (B2B)', false, 3)
on conflict (id) do nothing;

-- Sahkan:
-- select id, label, is_active, sort_order from public.payment_methods order by sort_order;
