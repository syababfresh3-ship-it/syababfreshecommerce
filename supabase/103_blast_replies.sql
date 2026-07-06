-- ============================================================
-- 103_blast_replies.sql
-- Reply per blast (attribution owned-media; mirror 084 ROAS).
-- Mesej MASUK (wa_messages.direction='in') dikira kepada blast PALING
-- TERKINI yang penerimanya (wa_id) padan & sent_at <= msg <= sent_at + 72 jam.
-- Last-touch (distinct on message) → satu mesej tak dikira dua kali.
-- Rollup: count DISTINCT wa_id per blast = berapa ORANG reply.
-- Nota: hanya reply selepas wa_messages mula direkod (tak boleh backfill).
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

-- Attribution per-mesej-masuk: 1 baris per mesej 'in' yang boleh dikira ke blast.
create or replace view public.crm_blast_reply_attribution as
select distinct on (m.id)
  m.id            as message_id,
  m.created_at    as replied_at,
  m.body,
  r.blast_id,
  r.wa_id,
  r.sent_at       as blast_sent_at
from public.wa_messages m
join public.wa_contacts c on c.id = m.contact_id
join public.crm_blast_recipients r
  on public.wa_norm_phone(r.wa_id) = public.wa_norm_phone(c.wa_id)
 and r.status in ('sent','delivered','read')
 and r.sent_at is not null
 and m.created_at >= r.sent_at
 and m.created_at <= r.sent_at + interval '72 hours'
where m.direction = 'in'
order by m.id, r.sent_at desc;

-- Rollup per blast: berapa orang reply + bila reply pertama.
create or replace view public.crm_blast_replies as
select
  blast_id,
  count(distinct wa_id)::int as replies,
  count(*)::int              as reply_messages,
  min(replied_at)            as first_reply_at
from public.crm_blast_reply_attribution
group by blast_id;

-- Ikut konvensyen 089: view hormati RLS (admin-only; API guna service role).
alter view public.crm_blast_reply_attribution set (security_invoker = on);
alter view public.crm_blast_replies           set (security_invoker = on);
