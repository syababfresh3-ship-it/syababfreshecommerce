-- 071: Aduan customer (AI support self-service) untuk page /bantuan.
-- AI assistant (Claude) buat intake + triage + escalate; resolusi duit dikawal
-- polisi server-side (Fasa 2). Polymorphic: sokong order storefront (orders) DAN
-- LP (lp_guest_orders) — sebab table refunds (054) link ke orders sahaja.
--
-- Idempotent. Jalankan di Supabase SQL Editor.

create table if not exists public.support_complaints (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Order (polymorphic — tiada FK sebab dua jadual berbeza)
  order_kind      text not null,                 -- 'store' | 'lp'
  order_id        uuid not null,
  order_number    text not null,
  customer_name   text,
  customer_phone  text,                          -- ternormal 60xxxxxxxxx
  customer_email  text,

  -- Aduan
  category        text,                          -- rosak|hilang|lambat|salah_item|soalan|lain
  status          text not null default 'open',  -- open|escalated|resolved|closed|rejected
  ai_summary      text,                          -- ringkasan AI untuk CS
  image_urls      text[] not null default '{}',  -- bukti gambar

  -- Resolusi (Fasa 2 — biar kosong Fasa 1)
  resolution_type   text,                        -- refund_full|refund_partial|store_credit|replacement|none
  resolution_amount numeric(10,2),
  refund_id         uuid,                         -- link ke refunds kalau jadi refund rasmi

  handled_by      text,                          -- 'ai' | admin user id
  abuse_flag      boolean not null default false
);

create index if not exists support_complaints_phone_idx  on public.support_complaints (customer_phone);
create index if not exists support_complaints_status_idx on public.support_complaints (status, created_at desc);
create index if not exists support_complaints_order_idx  on public.support_complaints (order_kind, order_id);

create table if not exists public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.support_complaints(id) on delete cascade,
  role         text not null,                    -- user|assistant
  content      text not null,
  created_at   timestamptz not null default now()
);
create index if not exists support_messages_complaint_idx on public.support_messages (complaint_id, created_at);

-- RLS: service-role sahaja (route guna admin client; customer akses via token HMAC).
alter table public.support_complaints enable row level security;
alter table public.support_messages   enable row level security;
-- Tiada policy untuk anon/authenticated → hanya service_role (server) boleh akses.
