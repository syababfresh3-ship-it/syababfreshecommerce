-- 170: POS borong — "Pay at pickup" (order disimpan belum bayar, dibayar di kaunter semasa ambil) dan tender
-- "Credit" (barang dilepaskan, hutang diselesaikan kemudian). Pemilik 25 Nov 2026: pelanggan borong bayar
-- masa pickup (tunai/QR/kad) dan ada juga kredit; team sale keyin awal, ada yang minta invois dulu.
-- Idempoten, additive. Tanpa migration ini kod menolak kaedah pickup/credit dengan 503 (kekangan check).

-- 1) Kaedah bayaran baharu: 'pickup' = placeholder pending (jumlah belum dibayar), 'credit' = hutang pelanggan
alter table public.pos_payments drop constraint if exists pos_payments_method_check;
alter table public.pos_payments add constraint pos_payments_method_check
  check (method in ('cash','duitnow_qr','card_terminal','ewallet_terminal','chip_link','pickup','credit'));

-- 2) Bayaran yang diambil dalam shift LAIN daripada jualan (pickup dibayar kemudian / penyelesaian kredit)
--    bawa shift_id sendiri supaya laci tunai shift itu betul; null = ikut shift jualan (tingkah laku lama).
alter table public.pos_payments
  add column if not exists shift_id            uuid references public.pos_shifts(id) on delete set null,
  add column if not exists settles_payment_id  uuid references public.pos_payments(id) on delete set null,   -- bayaran penyelesaian → baris kredit
  add column if not exists settled_at          timestamptz;                                                   -- pada baris kredit bila dah diselesaikan
create index if not exists pos_payments_shift_idx on public.pos_payments(shift_id) where shift_id is not null;
create index if not exists pos_payments_credit_open_idx on public.pos_payments(sale_id) where method = 'credit' and status = 'paid' and settled_at is null;

-- 3) Jualan pickup: ditanda, tarikh ambil pilihan, masa asal dikeyin (sold_at ditetapkan semula semasa dibayar)
alter table public.pos_sales
  add column if not exists is_pickup   boolean not null default false,
  add column if not exists pickup_date date,
  add column if not exists ordered_at  timestamptz;
create index if not exists pos_sales_pending_idx on public.pos_sales(sold_at desc) where status = 'pending';
