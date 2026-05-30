-- Pickup (self-collect) untuk LP guest orders — selari dengan orders.delivery_method.
-- pickup = ambil sendiri di kedai: tiada delivery fee, tiada alamat penghantaran.

alter table lp_guest_orders
  add column if not exists delivery_method text not null default 'delivery'
    check (delivery_method in ('delivery', 'pickup')),
  add column if not exists pickup_date date;

create index if not exists idx_lp_guest_orders_delivery_method on lp_guest_orders(delivery_method);
