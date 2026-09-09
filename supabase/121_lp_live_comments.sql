-- ============================================================
-- 121_lp_live_comments.sql
-- Komen penonton SEBENAR pada template LP "live".
-- Penonton hantar nama + komen (+ no. WhatsApp pilihan) melalui
-- POST /api/lp/[slug]/comment (rate limit + honeypot). Disimpan
-- sebagai 'pending'; dipaparkan di page hanya selepas admin luluskan
-- ('approved') di /admin/landing-pages/comments. Tiada komen rekaan.
--
-- Tiada polisi awam: semua insert/baca lalu API (service role).
-- Idempotent — selamat dijalankan semula.
-- ============================================================

create table if not exists public.lp_live_comments (
  id         uuid        primary key default gen_random_uuid(),
  page_id    uuid        not null references public.landing_pages(id) on delete cascade,
  name       text        not null,
  message    text        not null,
  phone      text,                              -- pilihan, untuk admin balas di WhatsApp
  status     text        not null default 'pending'
                         check (status in ('pending', 'approved', 'hidden')),
  ip_hash    text,                              -- hash pendek IP (jejak spam), bukan IP penuh
  created_at timestamptz not null default now()
);

create index if not exists idx_lp_live_comments_page_status
  on public.lp_live_comments (page_id, status, created_at desc);

alter table public.lp_live_comments enable row level security;

drop policy if exists "Admin full access" on public.lp_live_comments;
create policy "Admin full access" on public.lp_live_comments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
