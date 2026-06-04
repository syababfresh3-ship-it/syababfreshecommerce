-- 070: Jejak masa transisi penghantaran untuk lp_guest_orders.
-- lp_guest_orders sebelum ni cuma ada created_at/updated_at — tiada cap masa bila
-- order masuk 'delivering'. Ini perlukan untuk cron auto-deliver (mark delivered
-- selepas 7 hari) supaya tepat; updated_at tak boleh dipercayai (edit pukal reset).
--
-- Idempotent. Jalankan di Supabase SQL Editor.

alter table public.lp_guest_orders
  add column if not exists delivering_at timestamptz,
  add column if not exists delivered_at  timestamptz;

-- Backfill backlog: order yang SUDAH 'delivering' tapi delivering_at kosong → guna
-- created_at sebagai anggaran (masa sebenar dah hilang). Sedikit agresif (kira dari
-- masa order dibuat) tapi selamat — order lama yang masih delivering hampir pasti
-- dah sampai. Hanya isi yang NULL (idempotent).
update public.lp_guest_orders
   set delivering_at = created_at
 where status = 'delivering'
   and delivering_at is null;
