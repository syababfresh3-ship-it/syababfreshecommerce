-- ============================================================
-- 117_payment_method_enum.sql
-- WAJIB untuk kaedah bayaran baru berfungsi pada order MEMBER.
--
-- orders.payment_method ialah ENUM public.payment_method yang asalnya cuma
-- ('fpx','ewallet','cod','bank_transfer'). Insert 'card'/'duitnow'/'fpx_b2b'
-- LANGGAR enum → order member gagal ("Gagal buat pesanan" 500).
-- (lp_guest_orders.payment_method ialah text — guest tak terjejas.)
--
-- Tambah nilai baru ke enum. IF NOT EXISTS = idempotent.
-- Run di Supabase SQL Editor. Kalau ada ralat "cannot run inside a transaction
-- block", jalankan setiap baris SATU per SATU.
-- ============================================================

alter type public.payment_method add value if not exists 'card';
alter type public.payment_method add value if not exists 'duitnow';
alter type public.payment_method add value if not exists 'fpx_b2b';

-- Sahkan:
-- select unnest(enum_range(null::public.payment_method));
