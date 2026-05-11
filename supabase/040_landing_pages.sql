-- ============================================================
-- 040_landing_pages.sql
-- Custom landing pages for staff campaigns
-- Staff write HTML with {{product:slug}} placeholders.
-- System injects live product cards with Add-to-Cart.
-- ============================================================

create table if not exists public.landing_pages (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  title       text        not null,
  html_content text       not null default '',
  is_active   boolean     not null default true,
  created_by  uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.landing_pages enable row level security;

create policy "Admin full access" on public.landing_pages
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Public read active" on public.landing_pages
  for select using (is_active = true);
