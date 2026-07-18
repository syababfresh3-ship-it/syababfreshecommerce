-- Fasa 2: Cadangan kos dari Google Sheet invois → website (cadang & sahkan).
-- Akses: service role sahaja (RLS deny-all). Admin sahkan setiap cadangan sebelum
-- ia ditulis ke variant_costs.kos_buah. Bukan auto-apply.

create table if not exists cost_suggestions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  kos_buah_lama numeric(10,2),               -- kos_buah semasa (null kalau belum ada)
  kos_buah_baru numeric(10,2) not null,      -- kos landed dicadang dari sheet
  breakdown jsonb,                            -- {cfr, clearance, landed, rule, tarikh_invois, item_sheet}
  status text not null default 'pending',    -- pending | applied | ignored
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

-- Satu cadangan 'pending' sahaja per variant / per product-level (elak berganda).
create unique index if not exists cost_suggestions_pending_variant_uq
  on cost_suggestions (variant_id) where status = 'pending' and variant_id is not null;
create unique index if not exists cost_suggestions_pending_product_uq
  on cost_suggestions (product_id) where status = 'pending' and variant_id is null;

create index if not exists cost_suggestions_status_idx on cost_suggestions (status);

alter table cost_suggestions enable row level security;
-- Tiada policy = deny-all; hanya service-role (requireAdmin) boleh akses.
