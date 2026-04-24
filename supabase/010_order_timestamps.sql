-- Add missing status timestamp columns to orders
alter table orders
  add column if not exists preparing_at  timestamptz,
  add column if not exists delivering_at timestamptz;
