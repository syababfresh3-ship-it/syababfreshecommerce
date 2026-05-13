-- ============================================================
-- 047_ninja_cold_weight_tiers.sql
-- Weight-based shipping tiers for Ninja Van Cold (non-KL)
-- ============================================================

create table if not exists public.shipping_weight_tiers (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  text not null references public.shipping_carriers(id) on delete cascade,
  min_kg      numeric(8,2) not null,
  max_kg      numeric(8,2),             -- null = "and above"
  fee         numeric(10,2) not null,
  created_at  timestamptz not null default now()
);

create index if not exists shipping_weight_tiers_carrier_min
  on public.shipping_weight_tiers (carrier_id, min_kg);

alter table public.shipping_weight_tiers enable row level security;

create policy "weight_tiers_read_all" on public.shipping_weight_tiers
  for select using (true);

create policy "weight_tiers_admin" on public.shipping_weight_tiers
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Seed: Ninja Van Cold — Luar Lembah Klang pricing
insert into public.shipping_weight_tiers (carrier_id, min_kg, max_kg, fee) values
  ('ninja_cold',  0.00,  2.00, 15.00),
  ('ninja_cold',  2.00,  3.00, 17.00),
  ('ninja_cold',  3.00,  4.00, 19.00),
  ('ninja_cold',  4.00,  5.00, 21.00),
  ('ninja_cold',  5.00, 10.00, 30.00),
  ('ninja_cold', 10.00, 15.00, 35.00),
  ('ninja_cold', 15.00, 20.00, 40.00),
  ('ninja_cold', 20.00, 25.00, 45.00),
  ('ninja_cold', 25.00, 30.00, 50.00),
  ('ninja_cold', 30.00,  null, 60.00)
on conflict do nothing;
