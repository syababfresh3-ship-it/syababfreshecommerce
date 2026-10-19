-- ============================================================
-- 145: landing_pages.host — LP builder boleh dihidangkan di subdomain kurma
--
-- 'shop'  (lalai) → shop.syababfresh.my/lp/<slug>  (seperti sebelum ini)
-- 'kurma'         → kurma.syababfresh.my/lp/<slug> (proxy lalukan /lp/* di hos kurma;
--                   canonical/OG ikut hos kurma; tag {{kurma:...}} tersedia dalam HTML)
-- Kod toleran tanpa lajur ini (42703/PGRST204 → simpan tanpa host = kedai).
-- Idempotent — selamat dijalankan semula.
-- ============================================================
alter table public.landing_pages add column if not exists host text not null default 'shop';
alter table public.landing_pages drop constraint if exists landing_pages_host_check;
alter table public.landing_pages add constraint landing_pages_host_check check (host in ('shop', 'kurma'));
comment on column public.landing_pages.host is 'Domain awam LP: shop (shop.syababfresh.my/lp/slug) | kurma (kurma.syababfresh.my/lp/slug)';
