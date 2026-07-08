-- 104: Pricing List + P&L Website
-- Kos per variant (fallback per produk bila variant_id NULL) + kos operasi harian.
-- Akses: service role sahaja (RLS deny-all, tiada policy sengaja).

create table if not exists variant_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  kos_buah numeric(10,2) not null default 0,       -- kos buah landed, RM per unit jualan
  kos_packaging numeric(10,2) not null default 0,  -- kotak + bekas + sticker + free gift
  kos_kurier numeric(10,2) not null default 0,     -- anggaran kos penghantaran ditanggung seller
  kos_lain numeric(10,2) not null default 0,       -- wastage / overhead lain
  notes text,
  source text not null default 'manual',           -- 'manual' | 'tiktok-catalog' | 'sheet'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists variant_costs_variant_uq
  on variant_costs (variant_id) where variant_id is not null;
create unique index if not exists variant_costs_product_uq
  on variant_costs (product_id) where variant_id is null;

alter table variant_costs enable row level security;

-- Kos operasi harian (transport trip, pekerja, dll) — bukan per-unit produk
create table if not exists operating_costs (
  id uuid primary key default gen_random_uuid(),
  tarikh date not null,
  jenis text not null default 'transport',  -- transport | pekerja | sewa | lain
  amaun numeric(10,2) not null,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists operating_costs_tarikh_idx on operating_costs (tarikh);
alter table operating_costs enable row level security;

-- Settings gateway fee + target margin (guna app_settings sedia ada)
insert into app_settings (key, value) values
  ('gateway_fee_fpx_pct', '1.0'),
  ('gateway_fee_ewallet_pct', '1.5'),
  ('gateway_fee_fixed_rm', '0'),
  ('pricing_target_margin_pct', '25')
on conflict (key) do nothing;
