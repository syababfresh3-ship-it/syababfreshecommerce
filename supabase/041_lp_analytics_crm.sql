-- ============================================================
-- 041_lp_analytics_crm.sql
-- Analytics + CRM untuk landing pages
-- - view_count: bilangan lawatan unik per page
-- - meta_pixel_id / google_tag_id: tracking ads per page
-- - landing_page_leads: tangkap leads dari {{lead-form}}
-- ============================================================

-- Tambah kolum tracking pada landing_pages
alter table public.landing_pages
  add column if not exists meta_pixel_id  text,
  add column if not exists google_tag_id  text,
  add column if not exists view_count     integer not null default 0;

-- Table leads (CRM)
create table if not exists public.landing_page_leads (
  id        uuid        primary key default gen_random_uuid(),
  page_id   uuid        not null references public.landing_pages(id) on delete cascade,
  name      text,
  phone     text,
  source    text,        -- utm_source / utm_campaign
  created_at timestamptz not null default now()
);

alter table public.landing_page_leads enable row level security;

create policy "Admin full access" on public.landing_page_leads
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Sesiapa boleh submit lead (public form)
create policy "Public insert leads" on public.landing_page_leads
  for insert with check (true);

-- Fungsi atomic increment view count (panggil via RPC)
create or replace function public.increment_lp_view_count(p_slug text)
returns void language sql security definer as $$
  update public.landing_pages
  set view_count = view_count + 1
  where slug = p_slug and is_active = true;
$$;
