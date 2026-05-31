-- Loyalty redemption untuk LP orders (login-pilihan).
-- user_id: diisi bila pembeli LP login (untuk tebus mata + kredit earning yang tepat).
-- points_used / points_discount: mata ditebus + nilai diskaun (100 mata = RM1).
-- Earning LP sedia ada (awardLpLoyalty, match telefon) tidak berubah.

alter table lp_guest_orders
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists points_used integer not null default 0,
  add column if not exists points_discount numeric not null default 0;
