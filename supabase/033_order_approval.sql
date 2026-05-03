-- First-order approval flag to prevent fake COD orders from new accounts
alter table orders add column if not exists needs_approval boolean not null default false;

-- Index for fast fulfillment queries
create index if not exists idx_orders_needs_approval on orders(needs_approval) where needs_approval = true;
