-- ============================================================
-- 048_payment_webhook_fixes.sql
-- CHIP FPX webhook fixes:
--   1. webhook_logs — audit trail untuk setiap callback CHIP
--   2. lp_guest_orders.payment_ref — simpan CHIP purchase id
--      supaya page "berjaya" boleh verify bayaran terus (fallback)
-- ============================================================

-- 1. Audit log untuk semua webhook payment
create table if not exists public.webhook_logs (
  id          uuid        primary key default gen_random_uuid(),
  source      text        not null default 'chip',
  event_type  text,
  reference   text,        -- order id / lp_guest_order id (purchase.reference)
  status      text,        -- purchase status (paid, error, ...)
  verified    boolean      not null default false,
  raw         jsonb,
  created_at  timestamptz  not null default now()
);

create index if not exists webhook_logs_reference_idx  on public.webhook_logs (reference);
create index if not exists webhook_logs_created_at_idx on public.webhook_logs (created_at desc);

alter table public.webhook_logs enable row level security;

-- Admin sahaja boleh baca; insert dibuat via service role (bypass RLS)
create policy "Admin read webhook_logs" on public.webhook_logs
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- 2. Simpan CHIP purchase id pada LP guest order
alter table public.lp_guest_orders
  add column if not exists payment_ref text;
