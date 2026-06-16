-- ============================================================
-- 078_crm_tags.sql
-- Senarai tag terurus untuk CRM (track + filter). ADDITIVE.
-- Tag pada kontak tetap di wa_contacts.tags (array). Jadual ini =
-- senarai "tetap" yang boleh ditambah. Idempotent.
-- ============================================================

create table if not exists public.crm_tags (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  color      text,
  created_at timestamptz not null default now()
);

-- Seed default (boleh ubah/tambah kemudian)
insert into public.crm_tags (name, color) values
  ('VIP', 'amber'),
  ('Ceri-waitlist', 'rose'),
  ('Harumanis', 'yellow'),
  ('Reseller', 'blue'),
  ('Hot', 'red'),
  ('Cold', 'gray')
on conflict (name) do nothing;

alter table public.crm_tags enable row level security;
drop policy if exists "crm_tags: admin" on public.crm_tags;
create policy "crm_tags: admin" on public.crm_tags for all using (public.is_admin()) with check (public.is_admin());
