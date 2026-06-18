-- ============================================================
-- 080_crm_blast_status.sql
-- Blaster Fasa 1: jejak status penghantaran (sent → delivered → read → failed)
-- per-penerima blast, supaya progress campaign (gaya Reply.la) tepat.
-- ADDITIVE. Idempotent. Jalankan di Supabase SQL Editor.
-- ============================================================

-- 1) Cap masa peralihan status pada setiap penerima blast.
alter table public.crm_blast_recipients
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at      timestamptz,
  add column if not exists failed_at    timestamptz;

-- Index ikut wa_message_id — webhook update ikut id mesej WA.
create index if not exists idx_crm_blast_rcpt_msg
  on public.crm_blast_recipients(wa_message_id);

-- 2) View progress per-campaign (kiraan ikut status). Bucket selari Reply.la:
--    pending | unreached(failed) | sent | delivered | read.
create or replace view public.crm_blast_progress as
select
  blast_id,
  count(*)::int                                       as total,
  count(*) filter (where status = 'pending')::int     as pending,
  count(*) filter (where status = 'sent')::int        as sent,
  count(*) filter (where status = 'delivered')::int   as delivered,
  count(*) filter (where status = 'read')::int        as read,
  count(*) filter (where status = 'failed')::int      as failed
from public.crm_blast_recipients
group by blast_id;

-- 3) Advance status penerima ikut callback webhook WA. Rank-guarded supaya status
--    tak undur (cth 'delivered' lewat tak tindih 'read'). Hanya isi cap masa sekali.
--    Rank: read=4 > delivered=3 > failed=2 > sent=1 > pending=0.
create or replace function public.crm_blast_mark_status(p_msg text, p_status text)
returns void
language sql
as $$
  update public.crm_blast_recipients r
  set status       = p_status,
      delivered_at = case when p_status = 'delivered' then coalesce(r.delivered_at, now()) else r.delivered_at end,
      read_at      = case when p_status = 'read'      then coalesce(r.read_at, now())      else r.read_at end,
      failed_at    = case when p_status = 'failed'    then coalesce(r.failed_at, now())    else r.failed_at end
  where r.wa_message_id = p_msg
    and p_status in ('sent','delivered','read','failed')
    and (case p_status
           when 'read' then 4 when 'delivered' then 3 when 'failed' then 2 when 'sent' then 1 else 0 end)
      > (case r.status
           when 'read' then 4 when 'delivered' then 3 when 'failed' then 2 when 'sent' then 1 when 'pending' then 0 else 0 end);
$$;

-- 4) Statistik dashboard (semua campaign). Klien kira kadar dari kiraan mentah:
--    delivery_rate = delivered / sent ; read_rate = read / delivered.
create or replace function public.crm_blaster_overview()
returns table(
  campaigns_sent     int,
  messages_sent      int,   -- sampai WA (sent/delivered/read)
  messages_delivered int,   -- delivered/read
  messages_read      int,
  total_recipients   int
)
language sql
as $$
  select
    (select count(*) from public.crm_blasts            where status = 'sent')::int,
    (select count(*) from public.crm_blast_recipients  where status in ('sent','delivered','read'))::int,
    (select count(*) from public.crm_blast_recipients  where status in ('delivered','read'))::int,
    (select count(*) from public.crm_blast_recipients  where status = 'read')::int,
    (select count(*) from public.crm_blast_recipients)::int;
$$;
