-- ============================================================
-- 126_guest_reviews.sql — ulasan untuk pelanggan TETAMU (audit §3, Sprint 3D)
--
-- Dulu ulasan perlukan akaun + order `delivered` dalam `orders`; order tetamu
-- (lp_guest_orders) tak layak langsung → bukti sosial tersekat (5 ulasan).
-- Kini: selepas order sampai, email pautan bertoken (HMAC, 45 hari) ke
-- /ulasan?t=... — tanpa login. Ulasan disimpan melalui API service role
-- (tiada polisi awam baru), ditanda order_source/order_ref = "Pembeli disahkan".
--
-- Idempotent — selamat dijalankan semula.
-- ============================================================

alter table public.product_reviews alter column user_id drop not null;

alter table public.product_reviews
  add column if not exists guest_name   text,   -- nama dari order (dipendekkan bila dipapar)
  add column if not exists order_source text,   -- 'storefront' | 'lp'
  add column if not exists order_ref    text,   -- nombor order (SYB-… / LP-…)
  add column if not exists phone_norm   text;

alter table public.product_reviews drop constraint if exists product_reviews_order_source_check;
alter table public.product_reviews
  add constraint product_reviews_order_source_check
  check (order_source is null or order_source in ('storefront', 'lp'));

-- Satu ulasan per produk per order (null = ulasan lama dari page produk, tak terjejas)
create unique index if not exists product_reviews_order_ref_product_uq
  on public.product_reviews (order_source, order_ref, product_id);

create index if not exists idx_product_reviews_product_created
  on public.product_reviews (product_id, created_at desc);

-- Jemputan ulasan sekali per order LP (sama seperti orders.review_request_sent_at)
alter table public.lp_guest_orders add column if not exists review_request_sent_at timestamptz;
