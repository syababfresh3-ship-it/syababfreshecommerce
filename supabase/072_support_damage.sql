-- 072: Tambah butiran kerosakan berstruktur pada aduan support.
-- AI tanya item mana + berapa unit rosak / berapa % rosak (selari dgn borang
-- refund: calc per_unit/peratus). Memudahkan CS isi refund & sedia auto-refund (Fasa 2).
--
-- Idempotent. Jalankan di Supabase SQL Editor.

alter table public.support_complaints
  add column if not exists damage_items jsonb not null default '[]'::jsonb;

-- Bentuk setiap elemen damage_items (selari refund_items 054):
--   { item, qty_ordered?, calc('per_unit'|'peratus'), rosak_qty?, percent_rosak? }
