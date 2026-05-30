-- Pickup (self-collect) sokongan untuk orders.
-- delivery_method = 'pickup' bermakna customer ambil sendiri di kedai:
--   tiada delivery fee, tiada alamat penghantaran, tiada courier/AWB.
--   pickup_date = tarikh customer rancang nak ambil (slot masa tak dipakai).

alter table orders
  add column if not exists delivery_method text not null default 'delivery'
    check (delivery_method in ('delivery', 'pickup')),
  add column if not exists pickup_date date;

-- Tapisan pantas untuk admin (export & lalamove grouping kecualikan pickup)
create index if not exists idx_orders_delivery_method on orders(delivery_method);
