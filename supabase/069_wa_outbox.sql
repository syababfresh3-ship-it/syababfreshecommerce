-- 069: wa_outbox — beratur (queue) mesej WhatsApp customer supaya dihantar
-- berperingkat, bukan meletup serentak. Murpati ialah gateway WhatsApp TAK RASMI,
-- jadi blast 50–100 mesej sekaligus = risiko ban tinggi pada nombor sebenar.
--
-- Aliran: tracking-import (dan broadcast nanti) ENQUEUE ke sini dgn scheduled_at
-- berperingkat (jitter 30–90s sesama mesej). Cron /api/cron/wa-outbox-drain
-- (GitHub Actions ~tiap 10 min) hantar sikit-sikit ikut scheduled_at.
-- Email + Push tetap dihantar serta-merta (selamat & wajib) — hanya WA yg dipacing.
--
-- Idempotent — selamat dijalankan semula. Jalankan di Supabase SQL Editor.

create table if not exists public.wa_outbox (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,                       -- nombor mentah (dinormal masa hantar oleh sendWhatsApp)
  message       text not null,
  source        text not null default 'tracking',    -- tracking|broadcast|manual
  order_id      uuid,                                 -- rujukan order (storefront/lp); tiada FK sebab dua jadual
  status        text not null default 'pending',      -- pending|sent|failed
  scheduled_at  timestamptz not null default now(),   -- jangan hantar sebelum masa ini
  attempts      integer not null default 0,
  last_error    text,
  session_id    text,                                 -- session Murpati yg berjaya hantar (diisi selepas sent)
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- Index drainer: ambil 'pending' yg dah tiba masa, tertua dahulu (partial = ringan).
create index if not exists wa_outbox_due_idx
  on public.wa_outbox (scheduled_at)
  where status = 'pending';

-- RLS: hanya service_role (server) — sama posture macam jadual lain (065).
alter table public.wa_outbox enable row level security;
-- Tiada policy untuk anon/authenticated → hanya service_role (server) boleh akses.
