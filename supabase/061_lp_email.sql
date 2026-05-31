-- Tangkap email customer untuk LP guest orders (pilihan).
-- Bila diisi, sistem hantar email selari WhatsApp (backup bila WA down/ban).

alter table lp_guest_orders
  add column if not exists email text;
