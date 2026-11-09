-- ============================================================
-- 155_pos.sql — POS kaunter/bazar (pos.syababfresh.my). Lihat docs/plan-pos.md.
--
-- Jadual POS TERSENDIRI (pos_*): tidak tumpang orders / lp_guest_orders supaya
-- cron, eksport penghantaran & view blast sedia ada langsung tak tersentuh.
-- Akses POS ikut jadual pos_staff (BUKAN kolum pada profiles — polisi
-- "profiles: user can update own" hanya kunci is_admin, kolum lain boleh
-- diubah sendiri oleh ahli). Semua baca/tulis POS lalu /api/pos/* (service role).
-- RLS: admin sahaja (public.is_admin()) pada semua jadual; pos_staff boleh
-- select baris sendiri (gate proxy guna klien user).
-- Stok: pos_deduct_stock TIDAK raise bila kurang (jualan kaunter tak boleh gagal
-- kerana angka stok) — pulangkan kekurangan untuk direkod. Pulang guna
-- restore_stock (123). Baris ikut berat tak sentuh stok (lihat lib/pos/stock.ts).
-- ADDITIVE. Idempotent — selamat dijalankan semula.
-- ============================================================

-- ── Register (terminal) ─────────────────────────────────────
create table if not exists public.pos_registers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.pos_registers is 'Terminal/kaunter POS (cth T1 Kaunter Bangi, B1 Bazar). Peranti pilih satu register.';

-- ── Akses POS untuk akaun login (peranti / staf) ─────────────
create table if not exists public.pos_staff (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid,
  created_at timestamptz not null default now()
);
comment on table public.pos_staff is 'Akaun login yang dibenarkan buka pos.syababfresh.my (selain admin). Akaun peranti = is_admin false + baris di sini.';

-- ── Kasyer (PIN, bukan login) ───────────────────────────────
create table if not exists public.pos_cashiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  role text not null default 'cashier' check (role in ('cashier','manager')),
  profile_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.pos_cashiers is 'Kasyer POS: nama + PIN (scrypt hash). role manager boleh void / diskaun melebihi had.';

-- ── Shift (Fasa 3 UI; jadual disediakan sekarang) ───────────
create table if not exists public.pos_shifts (
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.pos_registers(id),
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(),
  opened_by uuid references public.pos_cashiers(id),
  opening_float numeric(10,2) not null default 0,
  closed_at timestamptz,
  closed_by uuid references public.pos_cashiers(id),
  counted_cash numeric(10,2),
  expected_cash numeric(10,2),
  variance numeric(10,2),
  summary jsonb,
  notes text
);
create unique index if not exists pos_shifts_one_open_idx on public.pos_shifts(register_id) where status = 'open';

create table if not exists public.pos_cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.pos_shifts(id) on delete cascade,
  type text not null check (type in ('in','out')),
  amount numeric(10,2) not null,
  reason text,
  cashier_id uuid references public.pos_cashiers(id),
  created_at timestamptz not null default now()
);

-- ── Nombor resit harian (atomik, tiada perlumbaan dua terminal) ──
create table if not exists public.pos_receipt_counters (
  day date primary key,
  last integer not null default 0
);

-- ── Jualan ──────────────────────────────────────────────────
create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text unique,
  local_ref text,
  client_txn_id uuid not null unique,
  register_id uuid references public.pos_registers(id),
  shift_id uuid references public.pos_shifts(id),
  cashier_id uuid references public.pos_cashiers(id),
  created_by uuid,
  customer_id uuid references public.customers(id) on delete set null,
  customer_phone text,
  customer_name text,
  status text not null default 'pending' check (status in ('pending','paid','void')),
  subtotal numeric(10,2) not null,
  discount_total numeric(10,2) not null default 0,
  discount_note text,
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  promo_code text,
  promo_discount numeric(10,2) not null default 0,
  rounding_adj numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  paid_total numeric(10,2) not null default 0,
  change_given numeric(10,2) not null default 0,
  weight_kg_total numeric(10,3) not null default 0,
  sold_at timestamptz not null default now(),
  paid_at timestamptz,
  offline boolean not null default false,
  voided_at timestamptz,
  voided_by uuid references public.pos_cashiers(id),
  void_reason text,
  stock_deducted_at timestamptz,
  stock_restored_at timestamptz,
  stock_notes text,
  loyalty_awarded_at timestamptz,
  receipt_sent_at timestamptz,
  public_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  note text,
  source text not null default 'pos',
  created_at timestamptz not null default now()
);
create index if not exists pos_sales_sold_at_idx on public.pos_sales(sold_at desc);
create index if not exists pos_sales_shift_idx on public.pos_sales(shift_id);
create index if not exists pos_sales_phone_idx on public.pos_sales(customer_phone);
comment on column public.pos_sales.client_txn_id is 'Kunci idempoten dari peranti (uuid). Hantar dua kali / replay offline → baris sama.';
comment on column public.pos_sales.local_ref is 'Rujukan sementara dicetak semasa offline (KOD-yymmdd-n) sebelum receipt_no diberi.';
comment on column public.pos_sales.rounding_adj is 'Pembundaran 5 sen (tender tunai sahaja).';
comment on column public.pos_sales.public_token is 'Token rawak untuk pautan resit awam /pos/resit/<token>.';

create table if not exists public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  sort int not null default 0,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  name text not null,
  variant_name text,
  sku text,
  barcode text,
  sell_by_weight boolean not null default false,
  qty numeric(10,3) not null,
  unit text not null default 'pcs' check (unit in ('pcs','kg')),
  unit_price numeric(10,2) not null,
  catalog_price numeric(10,2),
  line_discount numeric(10,2) not null default 0,
  line_total numeric(10,2) not null,
  stock_deducted boolean not null default false,
  stock_short numeric(10,3) not null default 0
);
create index if not exists pos_sale_items_sale_idx on public.pos_sale_items(sale_id);

create table if not exists public.pos_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  method text not null check (method in ('cash','duitnow_qr','card_terminal','ewallet_terminal','chip_link')),
  amount numeric(10,2) not null,
  tendered numeric(10,2),
  change_given numeric(10,2),
  ref text,
  status text not null default 'paid' check (status in ('pending','paid','failed','cancelled')),
  chip_purchase_id text,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pos_payments_sale_idx on public.pos_payments(sale_id);
create index if not exists pos_payments_chip_idx on public.pos_payments(chip_purchase_id);

-- ── Tetapan produk untuk POS (produk kedai TIDAK diubah) ─────
create table if not exists public.pos_product_settings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  pos_name text,
  sell_by_weight boolean not null default false,
  price_per_kg numeric(10,2),
  pos_price numeric(10,2),
  barcode text,
  is_quick_key boolean not null default false,
  quick_key_order int not null default 0,
  is_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index if not exists pos_product_settings_key_idx
  on public.pos_product_settings(product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create unique index if not exists pos_product_settings_barcode_idx
  on public.pos_product_settings(barcode) where barcode is not null;
comment on table public.pos_product_settings is 'Override POS per produk/varian: nama pendek, jual ikut berat (harga/kg), harga POS, barcode, kekunci pantas, sorok.';

-- ── RLS: admin sahaja; pos_staff select sendiri ──────────────
do $$
declare t text;
begin
  foreach t in array array['pos_registers','pos_staff','pos_cashiers','pos_shifts','pos_cash_movements',
                           'pos_receipt_counters','pos_sales','pos_sale_items','pos_payments','pos_product_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

drop policy if exists pos_staff_self on public.pos_staff;
create policy pos_staff_self on public.pos_staff
  for select to authenticated using (profile_id = auth.uid());

-- ── Fungsi ──────────────────────────────────────────────────

-- Nombor resit POS-YYYYMMDD-NNNN ikut tarikh Malaysia; upsert atomik pada kaunter harian.
create or replace function public.pos_next_receipt_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_seq integer;
begin
  insert into public.pos_receipt_counters(day, last) values (v_day, 1)
  on conflict (day) do update set last = public.pos_receipt_counters.last + 1
  returning last into v_seq;
  return 'POS-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Cipta jualan + baris + bayaran secara atomik. Idempoten ikut client_txn_id:
-- kalau dah wujud → pulangkan baris sedia ada dengan duplicate=true (replay offline / tekan dua kali).
create or replace function public.pos_create_sale(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn uuid := (p->>'client_txn_id')::uuid;
  v_id uuid;
  v_receipt text;
  v_status text := coalesce(p->>'status', 'paid');
  v_existing record;
begin
  if v_txn is null then raise exception 'client_txn_id diperlukan'; end if;

  select id, receipt_no, status into v_existing from public.pos_sales where client_txn_id = v_txn;
  if found then
    return jsonb_build_object('id', v_existing.id, 'receipt_no', v_existing.receipt_no, 'status', v_existing.status, 'duplicate', true);
  end if;

  v_receipt := public.pos_next_receipt_no();

  begin
    insert into public.pos_sales (
      receipt_no, local_ref, client_txn_id, register_id, shift_id, cashier_id, created_by,
      customer_id, customer_phone, customer_name, status,
      subtotal, discount_total, discount_note, promo_code_id, promo_code, promo_discount,
      rounding_adj, total, paid_total, change_given, weight_kg_total,
      sold_at, paid_at, offline, note
    ) values (
      v_receipt, p->>'local_ref', v_txn,
      nullif(p->>'register_id','')::uuid, nullif(p->>'shift_id','')::uuid, nullif(p->>'cashier_id','')::uuid, nullif(p->>'created_by','')::uuid,
      nullif(p->>'customer_id','')::uuid, nullif(p->>'customer_phone',''), nullif(p->>'customer_name',''), v_status,
      coalesce((p->>'subtotal')::numeric, 0), coalesce((p->>'discount_total')::numeric, 0), nullif(p->>'discount_note',''),
      nullif(p->>'promo_code_id','')::uuid, nullif(p->>'promo_code',''), coalesce((p->>'promo_discount')::numeric, 0),
      coalesce((p->>'rounding_adj')::numeric, 0), coalesce((p->>'total')::numeric, 0),
      coalesce((p->>'paid_total')::numeric, 0), coalesce((p->>'change_given')::numeric, 0), coalesce((p->>'weight_kg_total')::numeric, 0),
      coalesce((p->>'sold_at')::timestamptz, now()),
      case when v_status = 'paid' then coalesce((p->>'paid_at')::timestamptz, now()) else null end,
      coalesce((p->>'offline')::boolean, false), nullif(p->>'note','')
    ) returning id into v_id;
  exception when unique_violation then
    -- perlumbaan: permintaan serentak dengan client_txn_id sama
    select id, receipt_no, status into v_existing from public.pos_sales where client_txn_id = v_txn;
    return jsonb_build_object('id', v_existing.id, 'receipt_no', v_existing.receipt_no, 'status', v_existing.status, 'duplicate', true);
  end;

  insert into public.pos_sale_items (
    sale_id, sort, product_id, variant_id, name, variant_name, sku, barcode, sell_by_weight,
    qty, unit, unit_price, catalog_price, line_discount, line_total
  )
  select v_id, coalesce((i->>'sort')::int, ord::int - 1),
         nullif(i->>'product_id','')::uuid, nullif(i->>'variant_id','')::uuid,
         coalesce(i->>'name', 'Item'), nullif(i->>'variant_name',''), nullif(i->>'sku',''), nullif(i->>'barcode',''),
         coalesce((i->>'sell_by_weight')::boolean, false),
         coalesce((i->>'qty')::numeric, 1), coalesce(nullif(i->>'unit',''), 'pcs'),
         coalesce((i->>'unit_price')::numeric, 0), (i->>'catalog_price')::numeric,
         coalesce((i->>'line_discount')::numeric, 0), coalesce((i->>'line_total')::numeric, 0)
  from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) with ordinality as t(i, ord);

  insert into public.pos_payments (sale_id, method, amount, tendered, change_given, ref, status, chip_purchase_id, checkout_url, paid_at)
  select v_id, m->>'method', coalesce((m->>'amount')::numeric, 0), (m->>'tendered')::numeric, (m->>'change_given')::numeric,
         nullif(m->>'ref',''), coalesce(nullif(m->>'status',''), 'paid'), nullif(m->>'chip_purchase_id',''), nullif(m->>'checkout_url',''),
         case when coalesce(nullif(m->>'status',''), 'paid') = 'paid' then coalesce((m->>'paid_at')::timestamptz, now()) else null end
  from jsonb_array_elements(coalesce(p->'payments', '[]'::jsonb)) as t(m);

  return jsonb_build_object('id', v_id, 'receipt_no', v_receipt, 'status', v_status, 'duplicate', false);
end;
$$;

-- Tolak stok untuk baris pek — TIDAK raise. Pulangkan kekurangan (0 = cukup).
-- Varian → product_variants.stock; tanpa varian → inventory_batches FIFO (belum luput).
create or replace function public.pos_deduct_stock(p_product_id uuid, p_variant_id uuid, p_qty integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_remaining integer := coalesce(p_qty, 0);
  v_batch record;
  v_deduct integer;
begin
  if v_remaining <= 0 then return 0; end if;

  if p_variant_id is not null then
    select coalesce(stock, 0) into v_stock from public.product_variants where id = p_variant_id for update;
    if not found then return v_remaining; end if;
    v_deduct := least(v_stock, v_remaining);
    if v_deduct > 0 then
      update public.product_variants set stock = stock - v_deduct where id = p_variant_id;
    end if;
    return v_remaining - v_deduct;
  end if;

  for v_batch in
    select id, quantity from public.inventory_batches
    where product_id = p_product_id and expiry_date >= current_date and quantity > 0
    order by batch_date asc, created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_deduct := least(v_batch.quantity, v_remaining);
    update public.inventory_batches set quantity = quantity - v_deduct where id = v_batch.id;
    v_remaining := v_remaining - v_deduct;
  end loop;
  return v_remaining;
end;
$$;

-- Hanya service role boleh panggil (corak 122).
do $$
declare r record;
begin
  for r in select unnest(array[
      'public.pos_next_receipt_no()',
      'public.pos_create_sale(jsonb)',
      'public.pos_deduct_stock(uuid, uuid, integer)'
    ]) as sig
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ── View jumlah bayaran per jualan (laporan X/Z, senarai admin) ──
create or replace view public.pos_payment_totals_v as
  select sale_id, method, sum(amount) as amount
  from public.pos_payments
  where status = 'paid'
  group by sale_id, method;
alter view public.pos_payment_totals_v set (security_invoker = on);

-- ── Seed register pertama ───────────────────────────────────
insert into public.pos_registers (code, name, location)
select 'T1', 'Kaunter Bangi', 'Bandar Baru Bangi'
where not exists (select 1 from public.pos_registers);
