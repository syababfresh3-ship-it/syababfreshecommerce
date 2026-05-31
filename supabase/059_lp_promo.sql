-- Kod promosi untuk LP guest orders (selari dengan orders.promo_code_id + discount).
-- Guest: hanya had global (max_uses, expiry, min_order) terpakai — tiada had per-user.

alter table lp_guest_orders
  add column if not exists promo_code_id uuid references promo_codes(id),
  add column if not exists discount numeric not null default 0;
