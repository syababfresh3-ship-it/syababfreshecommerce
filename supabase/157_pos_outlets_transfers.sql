-- ============================================================
-- 157: POS — outlet (HQ / bazar), stok per outlet, pindahan HQ → outlet (DO), lejar pergerakan
-- Aliran pemilik (9 Nov 2026): outlet ambil barang di HQ → HQ keluarkan DO (stok HQ pek ditolak,
-- stok outlet bertambah serta-merta) → staf bertugas di outlet sahkan kuantiti (varians direkod)
-- → HQ pantau stok outlet. Jualan POS di register outlet tolak stok outlet (bukan stok kedai).
-- Unit baris DO: pcs | kg | ctn (ctn × pack_size → pcs). DO tanpa harga. Siri sendiri DO-YYYYMM-NNNN.
-- Additive & idempotent. docs/plan-pos.md (Fasa 2.5).
-- ============================================================

-- ── Outlet ──────────────────────────────────────────────────
create table if not exists public.pos_outlets (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  type        text not null default 'bazaar' check (type in ('hq','bazaar','store')),
  location    text,
  is_active   boolean not null default true,
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now()
);
comment on table public.pos_outlets is 'Lokasi stok POS: HQ (stok kedai sedia ada) atau outlet bazar/kedai cawangan (stok sendiri di pos_outlet_stock).';

alter table public.pos_registers add column if not exists outlet_id uuid references public.pos_outlets(id) on delete set null;
alter table public.pos_sales     add column if not exists outlet_id uuid references public.pos_outlets(id) on delete set null;
create index if not exists pos_sales_outlet_idx on public.pos_sales (outlet_id, sold_at desc);

-- Seed HQ + pautkan register sedia ada (T1) ke HQ supaya tolakan stok kedai kekal seperti sebelum ini
insert into public.pos_outlets (code, name, type, location)
select 'HQ', 'HQ Bangi', 'hq', 'Bandar Baru Bangi'
where not exists (select 1 from public.pos_outlets where type = 'hq');
update public.pos_registers set outlet_id = (select id from public.pos_outlets where type = 'hq' order by created_at limit 1)
where outlet_id is null;

-- Trigger: jualan baharu warisi outlet register (pos_create_sale tidak diubah)
create or replace function public.pos_sales_set_outlet()
returns trigger language plpgsql as $$
begin
  if new.outlet_id is null and new.register_id is not null then
    select outlet_id into new.outlet_id from public.pos_registers where id = new.register_id;
  end if;
  return new;
end $$;
drop trigger if exists pos_sales_set_outlet on public.pos_sales;
create trigger pos_sales_set_outlet before insert on public.pos_sales
  for each row execute function public.pos_sales_set_outlet();

-- ── Stok outlet (baki semasa) + lejar ──────────────────────
create table if not exists public.pos_outlet_stock (
  id          uuid primary key default gen_random_uuid(),
  outlet_id   uuid not null references public.pos_outlets(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid references public.product_variants(id) on delete cascade,
  unit        text not null check (unit in ('pcs','kg')),
  qty         numeric(12,3) not null default 0,
  updated_at  timestamptz not null default now()
);
create unique index if not exists pos_outlet_stock_uniq
  on public.pos_outlet_stock (outlet_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), unit);
comment on table public.pos_outlet_stock is 'Baki stok semasa per outlet (pcs untuk pek/varian, kg untuk timbang). HQ tidak disimpan di sini (guna stok kedai).';

create table if not exists public.pos_stock_movements (
  id          uuid primary key default gen_random_uuid(),
  outlet_id   uuid not null references public.pos_outlets(id) on delete cascade,
  product_id  uuid not null,
  variant_id  uuid,
  unit        text not null check (unit in ('pcs','kg')),
  qty         numeric(12,3) not null,                 -- +masuk / -keluar
  type        text not null check (type in ('transfer_in','transfer_out','sale','void_restore','adjustment','wastage','count')),
  ref_type    text,                                   -- 'transfer' | 'sale'
  ref_id      uuid,
  note        text,
  created_by  uuid,
  cashier_id  uuid references public.pos_cashiers(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists pos_stock_movements_outlet_idx on public.pos_stock_movements (outlet_id, created_at desc);
create index if not exists pos_stock_movements_ref_idx on public.pos_stock_movements (ref_type, ref_id);

-- ── Pindahan (DO) ──────────────────────────────────────────
create table if not exists public.pos_transfer_counters (month text primary key, last integer not null default 0);

create table if not exists public.pos_transfers (
  id                   uuid primary key default gen_random_uuid(),
  doc_no               text unique,                   -- diberi semasa Issue (draf tiada nombor)
  kind                 text not null default 'out' check (kind in ('out','return')),
  from_outlet_id       uuid not null references public.pos_outlets(id),
  to_outlet_id         uuid not null references public.pos_outlets(id),
  status               text not null default 'draft' check (status in ('draft','issued','confirmed','cancelled')),
  note                 text,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  issued_at            timestamptz,
  issued_by            uuid,
  stock_applied_at     timestamptz,
  confirmed_at         timestamptz,
  confirmed_by         uuid,
  confirmed_cashier_id uuid references public.pos_cashiers(id) on delete set null,
  confirmed_note       text,
  check (from_outlet_id <> to_outlet_id)
);
create index if not exists pos_transfers_to_idx on public.pos_transfers (to_outlet_id, status, created_at desc);

create table if not exists public.pos_transfer_items (
  id             uuid primary key default gen_random_uuid(),
  transfer_id    uuid not null references public.pos_transfers(id) on delete cascade,
  sort           integer not null default 0,
  product_id     uuid references public.products(id) on delete set null,
  variant_id     uuid references public.product_variants(id) on delete set null,
  name           text not null,
  variant_name   text,
  unit           text not null check (unit in ('pcs','kg','ctn')),
  qty            numeric(12,3) not null check (qty > 0),
  pack_size      numeric(12,3),                       -- pcs per ctn bila unit = ctn
  base_unit      text not null check (base_unit in ('pcs','kg')),
  base_qty       numeric(12,3) not null,              -- qty dalam unit stok (ctn × pack_size)
  received_qty   numeric(12,3),                       -- diisi semasa pengesahan outlet
  hq_stock_short numeric(12,3) not null default 0,    -- kekurangan stok HQ semasa issue (tak menghalang)
  note           text
);
create index if not exists pos_transfer_items_transfer_idx on public.pos_transfer_items (transfer_id, sort);

-- ── RLS admin sahaja (corak 155); POS tulis via service role ──
do $$
declare t text;
begin
  foreach t in array array['pos_outlets','pos_outlet_stock','pos_stock_movements','pos_transfer_counters','pos_transfers','pos_transfer_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- ── Fungsi ──────────────────────────────────────────────────
-- Nombor DO-YYYYMM-NNNN (bulan Malaysia), upsert atomik.
create or replace function public.pos_next_transfer_no()
returns text language plpgsql security definer set search_path = public as $$
declare v_month text := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYYYMM'); v_seq integer;
begin
  insert into public.pos_transfer_counters(month, last) values (v_month, 1)
  on conflict (month) do update set last = public.pos_transfer_counters.last + 1
  returning last into v_seq;
  return 'DO-' || v_month || '-' || lpad(v_seq::text, 4, '0');
end $$;

-- Tambah/tolak stok outlet. Tidak pernah RAISE: baki tak boleh negatif → clamp 0 dan pulangkan kekurangan.
create or replace function public.pos_outlet_stock_apply(p_outlet uuid, p_product uuid, p_variant uuid, p_unit text, p_delta numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cur numeric; v_new numeric; v_short numeric := 0;
        v_zero uuid := '00000000-0000-0000-0000-000000000000'::uuid;
begin
  select id, qty into v_id, v_cur from public.pos_outlet_stock
   where outlet_id = p_outlet and product_id = p_product and coalesce(variant_id, v_zero) = coalesce(p_variant, v_zero) and unit = p_unit
   for update;
  if v_id is null then
    v_new := p_delta;
    if v_new < 0 then v_short := -v_new; v_new := 0; end if;
    begin
      insert into public.pos_outlet_stock (outlet_id, product_id, variant_id, unit, qty) values (p_outlet, p_product, p_variant, p_unit, v_new);
    exception when unique_violation then
      update public.pos_outlet_stock set qty = greatest(0, qty + p_delta), updated_at = now()
       where outlet_id = p_outlet and product_id = p_product and coalesce(variant_id, v_zero) = coalesce(p_variant, v_zero) and unit = p_unit;
    end;
  else
    v_new := v_cur + p_delta;
    if v_new < 0 then v_short := -v_new; v_new := 0; end if;
    update public.pos_outlet_stock set qty = v_new, updated_at = now() where id = v_id;
  end if;
  return v_short;
end $$;

do $$
declare r record;
begin
  for r in select unnest(array['public.pos_next_transfer_no()', 'public.pos_outlet_stock_apply(uuid, uuid, uuid, text, numeric)']) as sig
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
