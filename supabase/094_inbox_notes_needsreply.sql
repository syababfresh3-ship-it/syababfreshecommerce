-- ============================================================
-- 094_inbox_notes_needsreply.sql
-- Ciri inbox CRM Fasa 1:
--   1. Internal notes (team-only) per contact — wa_contacts.notes
--   2. "Need reply" — wa_conversations.needs_reply (true bila mesej terakhir dari
--      customer/inbound; false bila admin balas). Webhook set true, send set false.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

alter table public.wa_contacts      add column if not exists notes text;
alter table public.wa_conversations add column if not exists needs_reply boolean not null default false;

create index if not exists idx_wa_conv_needsreply on public.wa_conversations(needs_reply) where needs_reply = true;

-- Backfill needs_reply: true di mana mesej TERAKHIR conversation = inbound (in).
update public.wa_conversations c
set needs_reply = true
where (
  select m.direction from public.wa_messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
) = 'in';
