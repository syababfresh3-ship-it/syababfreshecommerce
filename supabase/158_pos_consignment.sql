-- ============================================================
-- 158: POS — konsainan (barang pembekal lain dijual di kedai kita)
-- Pembekal + terma bayaran (kos seunit ATAU komisen %), produk dipaut ke pembekal melalui
-- pos_product_settings, jumlah perlu dibayar DISNAPSHOT pada baris jualan semasa jual (perubahan
-- terma kemudian tidak mengubah sejarah), penyata penyelesaian bernombor CS-YYYYMM-NNNN yang
-- menandakan baris supaya dibayar sekali sahaja, dan log stok masuk / pulang per pembekal.
-- Additive & idempotent. docs/plan-pos.md (9 Nov 2026).
-- ============================================================

create table if not exists public.pos_consignors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text,
  payout_type    text not null default 'commission' check (payout_type in ('cost','commission')),
  commission_pct numeric(5,2) not null default 20 check (commission_pct >= 0 and commission_pct <= 100),
  bank_name      text,
  bank_account   text,
  bank_holder    text,
  note           text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.pos_consignors is 'Pembekal konsainan. payout_type cost = bayar kos seunit; commission = kedai ambil commission_pct daripada jualan, baki dibayar kepada pembekal.';

-- Produk → pembekal + terma (baris produk variant_id null: pembekal, komisen override, kos lalai / per kg;
-- baris varian: kos seunit varian itu)
alter table public.pos_product_settings add column if not exists consignor_id uuid references public.pos_consignors(id) on delete set null;
alter table public.pos_product_settings add column if not exists consign_cost numeric(10,2) check (consign_cost is null or consign_cost >= 0);
alter table public.pos_product_settings add column if not exists consign_commission_pct numeric(5,2) check (consign_commission_pct is null or (consign_commission_pct >= 0 and consign_commission_pct <= 100));
create index if not exists pos_product_settings_consignor_idx on public.pos_product_settings (consignor_id) where consignor_id is not null;

-- Penyata penyelesaian
create table if not exists public.pos_consign_counters (month text primary key, last integer not null default 0);
create table if not exists public.pos_consign_settlements (
  id               uuid primary key default gen_random_uuid(),
  doc_no           text unique,
  consignor_id     uuid not null references public.pos_consignors(id),
  period_from      date not null,
  period_to        date not null,
  lines            integer not null default 0,
  sales_total      numeric(12,2) not null default 0,
  payable_total    numeric(12,2) not null default 0,
  commission_total numeric(12,2) not null default 0,
  status           text not null default 'unpaid' check (status in ('unpaid','paid')),
  paid_at          timestamptz,
  pay_ref          text,
  note             text,
  created_by       uuid,
  created_at       timestamptz not null default now()
);
create index if not exists pos_consign_settlements_consignor_idx on public.pos_consign_settlements (consignor_id, created_at desc);

-- Snapshot pada baris jualan
alter table public.pos_sale_items add column if not exists consignor_id uuid references public.pos_consignors(id) on delete set null;
alter table public.pos_sale_items add column if not exists consign_payable numeric(10,2);
alter table public.pos_sale_items add column if not exists consign_settlement_id uuid references public.pos_consign_settlements(id) on delete set null;
create index if not exists pos_sale_items_consignor_idx on public.pos_sale_items (consignor_id, consign_settlement_id) where consignor_id is not null;

-- Stok konsainan masuk / pulang
create table if not exists public.pos_consign_stock_moves (
  id           uuid primary key default gen_random_uuid(),
  consignor_id uuid not null references public.pos_consignors(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  variant_id   uuid references public.product_variants(id) on delete cascade,
  unit         text not null default 'pcs' check (unit in ('pcs','kg')),
  qty          numeric(12,3) not null check (qty > 0),
  type         text not null check (type in ('in','return')),
  note         text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists pos_consign_stock_moves_consignor_idx on public.pos_consign_stock_moves (consignor_id, created_at desc);

-- RLS admin sahaja (corak 155)
do $$
declare t text;
begin
  foreach t in array array['pos_consignors','pos_consign_counters','pos_consign_settlements','pos_consign_stock_moves']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- Nombor penyata CS-YYYYMM-NNNN (bulan Malaysia), upsert atomik.
create or replace function public.pos_next_consign_no()
returns text language plpgsql security definer set search_path = public as $$
declare v_month text := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYYYMM'); v_seq integer;
begin
  insert into public.pos_consign_counters(month, last) values (v_month, 1)
  on conflict (month) do update set last = public.pos_consign_counters.last + 1
  returning last into v_seq;
  return 'CS-' || v_month || '-' || lpad(v_seq::text, 4, '0');
end $$;
revoke execute on function public.pos_next_consign_no() from public, anon, authenticated;
grant execute on function public.pos_next_consign_no() to service_role;
