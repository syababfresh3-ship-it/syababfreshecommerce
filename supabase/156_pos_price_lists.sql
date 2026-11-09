-- ============================================================
-- 156: POS — senarai harga (price list) per register / outlet
-- Harga berbeza ikut outlet (kedai Bangi vs bazar). Satu senarai boleh dipakai ramai register.
-- Register tanpa senarai = harga kedai (+ override global pos_product_settings) seperti sebelum ini.
-- Additive & idempotent. docs/plan-pos.md (9 Nov 2026).
-- ============================================================

create table if not exists public.pos_price_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.pos_price_lists is 'Senarai harga POS (cth Store, Bazar Ramadan). Dipautkan ke pos_registers.price_list_id.';

create table if not exists public.pos_price_list_items (
  id            uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.pos_price_lists(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete cascade,
  price         numeric(10,2) check (price is null or price >= 0),          -- harga pek/unit; null = ikut lalai
  price_per_kg  numeric(10,2) check (price_per_kg is null or price_per_kg >= 0), -- harga/kg item timbang (baris variant_id null)
  updated_at    timestamptz not null default now()
);
comment on table public.pos_price_list_items is 'Harga per produk/varian dalam satu senarai harga POS. Tiada baris / null = jatuh ke harga lalai.';

create unique index if not exists pos_price_list_items_uniq
  on public.pos_price_list_items (price_list_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists pos_price_list_items_list_idx on public.pos_price_list_items (price_list_id);

alter table public.pos_registers add column if not exists price_list_id uuid references public.pos_price_lists(id) on delete set null;
comment on column public.pos_registers.price_list_id is 'Senarai harga yang dipakai register ini; null = harga kedai.';

-- RLS: admin sahaja (corak 155). POS baca melalui service role di /api/pos/*.
do $$
declare t text;
begin
  foreach t in array array['pos_price_lists','pos_price_list_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;
