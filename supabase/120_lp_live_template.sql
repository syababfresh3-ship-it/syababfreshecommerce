-- ============================================================
-- 120_lp_live_template.sql
-- Template LP "live": susun atur gaya TikTok (video menegak penuh
-- skrin, kad produk, komen bergerak) — dengan KANDUNGAN SEBENAR:
-- tiada badge LIVE palsu, tiada kiraan penonton/like rekaan, komen
-- bergerak diambil dari product_reviews sebenar.
--
-- template    : 'classic' (HTML + placeholder, sedia ada) | 'live'
-- live_config : jsonb, bentuk ditentukan di src/lib/lp-live.ts
-- Idempotent — selamat dijalankan semula.
-- ============================================================

alter table public.landing_pages
  add column if not exists template    text  not null default 'classic',
  add column if not exists live_config jsonb;

alter table public.landing_pages drop constraint if exists landing_pages_template_check;
alter table public.landing_pages
  add constraint landing_pages_template_check check (template in ('classic', 'live'));
