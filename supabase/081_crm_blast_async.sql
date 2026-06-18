-- ============================================================
-- 081_crm_blast_async.sql
-- Blaster Fasa 4: hantar async (queue) + scheduling.
-- Penerima disimpan 'pending' → drainer (cron) claim batch & hantar.
-- ADDITIVE. Idempotent. Jalankan di Supabase SQL Editor.
-- ============================================================

-- Merge field per-penerima (dari CSV) + cap masa claim (untuk reclaim stale).
alter table public.crm_blast_recipients
  add column if not exists vars       jsonb not null default '{}',
  add column if not exists claimed_at timestamptz;

-- Gambar header disimpan pada campaign supaya drainer (async) boleh guna.
alter table public.crm_blasts
  add column if not exists header_image text;

-- Index batch pending (drainer ambil tertua dahulu).
create index if not exists idx_crm_blast_rcpt_pending
  on public.crm_blast_recipients(blast_id, created_at)
  where status in ('pending', 'sending');

-- View progress — 'sending' (sedang dihantar) dikira bersama pending.
create or replace view public.crm_blast_progress as
select
  blast_id,
  count(*)::int                                                  as total,
  count(*) filter (where status in ('pending','sending'))::int   as pending,
  count(*) filter (where status = 'sent')::int                   as sent,
  count(*) filter (where status = 'delivered')::int              as delivered,
  count(*) filter (where status = 'read')::int                   as read,
  count(*) filter (where status = 'failed')::int                 as failed
from public.crm_blast_recipients
group by blast_id;

-- Claim batch penerima secara atomik (FOR UPDATE SKIP LOCKED) supaya dua drainer
-- (cron + send-now) tak hantar berganda. Reclaim 'sending' yang tersangkut >5 minit.
create or replace function public.crm_blast_claim(p_blast_id uuid, p_limit int)
returns setof public.crm_blast_recipients
language plpgsql
as $$
begin
  return query
  update public.crm_blast_recipients r
  set status = 'sending', claimed_at = now()
  where r.id in (
    select id from public.crm_blast_recipients
    where blast_id = p_blast_id
      and (status = 'pending' or (status = 'sending' and claimed_at < now() - interval '5 minutes'))
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning r.*;
end;
$$;
