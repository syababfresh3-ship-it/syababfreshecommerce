-- 074: order_dispatches — rekod scan-out fizikal (SOP Dispatch, Fasa 2).
-- Tujuan: bezakan "tracking dah assign" vs "barang BETUL-BETUL keluar fizikal".
-- TIDAK tolak stok (stok dah ditolak masa bayaran disahkan — elak double-deduct).
-- Satu order = satu rekod dispatch (unique order_number → scan ulang idempotent).
--
-- Idempotent. Jalankan di Supabase SQL Editor.

create table if not exists public.order_dispatches (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid,                          -- ref orders.id ATAU lp_guest_orders.id (polimorfik)
  source       text not null,                 -- 'shop' | 'lp'
  order_number text not null,
  scanned_at   timestamptz not null default now(),
  scanned_by   uuid references auth.users(id),
  courier      text,
  photo_url    text,                          -- nullable, untuk hidupkan gambar bukti kemudian
  notes        text
);

create unique index if not exists uniq_order_dispatches_order_number
  on public.order_dispatches(order_number);
create index if not exists idx_order_dispatches_scanned_at
  on public.order_dispatches(scanned_at desc);

alter table public.order_dispatches enable row level security;

-- Ops table — admin sahaja. API guna service-role; policy ini untuk akses langsung.
drop policy if exists "dispatches_admin_all" on public.order_dispatches;
create policy "dispatches_admin_all" on public.order_dispatches
  for all using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  );
