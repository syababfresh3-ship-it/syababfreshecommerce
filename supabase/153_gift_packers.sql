-- ============================================================
-- 153_gift_packers.sql
-- Team packer (PIC pack) BERASINGAN daripada admin/sales: packer bukan pengguna admin,
-- jadi senarai nama sendiri (jadual gift_packers) — bukan profiles.
-- gift_deals.packer_id kini rujuk gift_packers (FK lama ke profiles digugurkan; nilai lama
-- yang bukan packer dikosongkan). Selamat dijalankan selepas 150. ADDITIVE. Idempotent.
-- ============================================================
create table if not exists public.gift_packers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.gift_packers is 'Team packer gift kurma (PIC pack). Bukan akaun admin — senarai nama (+ telefon) sahaja.';
comment on column public.gift_packers.is_active is 'false = tidak dipapar dalam pilihan PIC pack (nama kekal pada deal lama).';

alter table public.gift_packers enable row level security;
drop policy if exists gift_packers_admin on public.gift_packers;
create policy gift_packers_admin on public.gift_packers
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Tukar rujukan packer_id: profiles → gift_packers.
alter table public.gift_deals add column if not exists packer_id uuid;   -- jika 150 belum dijalankan
alter table public.gift_deals drop constraint if exists gift_deals_packer_id_fkey;
update public.gift_deals set packer_id = null
  where packer_id is not null and packer_id not in (select id from public.gift_packers);
alter table public.gift_deals
  add constraint gift_deals_packer_id_fkey foreign key (packer_id) references public.gift_packers(id) on delete set null;
comment on column public.gift_deals.packer_id is 'PIC pack: packer (gift_packers) yang ditugaskan siapkan pek untuk deal ini.';
