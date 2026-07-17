-- ============================================================
-- 107_order_client_ip.sql
-- Anti-bot: simpan IP pemanggil pada order (guest + member) untuk
-- had kadar global (20/IP/jam, 3/telefon/jam, 3/email/jam) + forensik.
-- Nota: partial index "created_at terkini" TIDAK boleh (now() bukan
-- immutable) — index biasa memadai (jadual kecil, puluhan row/hari).
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

alter table public.lp_guest_orders add column if not exists client_ip text;
alter table public.orders          add column if not exists client_ip text;

create index if not exists idx_lp_guest_orders_created_recent
  on public.lp_guest_orders (created_at desc);
create index if not exists idx_orders_ip_created
  on public.orders (client_ip, created_at desc);

comment on column public.lp_guest_orders.client_ip is 'IP pemanggil masa order dibuat (anti-bot/forensik)';
comment on column public.orders.client_ip is 'IP pemanggil masa order dibuat (anti-bot/forensik)';
