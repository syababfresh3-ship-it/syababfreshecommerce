-- Slot masa penghantaran untuk LP guest orders — selari dengan orders.delivery_slot.
-- Label slot (cth "Esok, 8am – 12pm") disimpan sebagai teks; paparan sahaja, tidak
-- mempengaruhi harga. Null untuk pickup atau bila admin matikan semua slot.

alter table public.lp_guest_orders
  add column if not exists delivery_slot text;
