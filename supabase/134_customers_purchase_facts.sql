-- ============================================================
-- 134_customers_purchase_facts.sql
-- Fakta beli per pelanggan pada jadual `customers` — untuk page /admin/database.
--
-- MASALAH: `customers` (065) simpan order_count/total_spend/last_order_at tetapi
-- tidak PRODUK yang dibeli, KUPON yang digunakan, atau tarikh ORDER PERTAMA.
-- Semua ini boleh dikira, tetapi mengiranya masa render bermakna join telefon
-- merentas `orders`+`order_items`+`lp_guest_orders`(jsonb)+`promo_codes` setiap
-- kali page dibuka — mahal untuk plan Micro yang ketat IO.
--
-- PENYELESAIAN: simpan sebagai cache agregat, sama seperti order_count/total_spend
-- yang sedia ada. Diisi oleh refreshCustomerAggregates() (lib/customers.ts) —
-- cron harian `refresh-customers` + butang "Segarkan sekarang" di page.
--
-- first_order_at BERBEZA dari first_seen_at: first_seen_at = min tarikh
-- daftar/lead/order (termasuk order yang tak dikira). Lead yang kemudian beli
-- akan tunjuk tarikh lead pada first_seen_at; first_order_at = order pertama
-- yang DIKIRA (peraturan counts(): bukan cancelled/refunded, online mesti paid).
--
-- Tiada indeks GIN: penapis dibuat di sisi klien atas senarai penuh; indeks
-- hanya tambah kos tulis pada upsert harian tanpa sebarang query @> di pelayan.
-- Idempotent — selamat dijalankan semula.
-- ============================================================

alter table public.customers
  add column if not exists product_names  text[]      not null default '{}',
  add column if not exists coupon_codes   text[]      not null default '{}',
  add column if not exists coupon_count   integer     not null default 0,
  add column if not exists first_order_at timestamptz;

comment on column public.customers.product_names  is
  'Nama produk berbeza yang pernah dibeli (order yang DIKIRA sahaja, dedup ikut product_name). Diisi refreshCustomerAggregates().';
comment on column public.customers.coupon_codes   is
  'Kod promo berbeza yang pernah digunakan (kod yang masih wujud sahaja). Diisi refreshCustomerAggregates().';
comment on column public.customers.coupon_count   is
  'Bilangan order DIKIRA yang ada promo_code_id dengan kod yang masih wujud. Sentiasa <= order_count.';
comment on column public.customers.first_order_at is
  'Order pertama yang DIKIRA. Berbeza dari first_seen_at (min tarikh daftar/lead/order). Sentiasa <= last_order_at.';
