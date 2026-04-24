-- Promo codes table
create table if not exists promo_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  type        text not null check (type in ('percentage', 'fixed')),
  value       numeric(10,2) not null,   -- % or RM amount
  min_order   numeric(10,2) default 0,  -- minimum cart total
  max_uses    int default null,          -- null = unlimited
  uses_count  int default 0 not null,
  active      boolean default true not null,
  expires_at  timestamptz default null,
  created_at  timestamptz default now()
);

-- RLS
alter table promo_codes enable row level security;

-- Customers can read active, non-expired codes (for validation)
create policy "active promo readable by all"
  on promo_codes for select
  using (active = true);

-- Only admins can manage
create policy "admins manage promo codes"
  on promo_codes for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

-- Function to increment uses count safely
create or replace function increment_promo_uses(promo_id uuid)
returns void
language sql
security definer
as $$
  update promo_codes
  set uses_count = uses_count + 1
  where id = promo_id;
$$;
