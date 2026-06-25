-- ============================================================
-- 096_wa_ai_chatbot — F1 AI Chatbot (additive, OFF by default).
-- Hanya tambah lajur/jadual/flag. TIADA kelakuan berubah sehingga F2 (webhook
-- hook) + master switch dihidupkan. Selamat dijalankan awal.
-- ============================================================

-- Toggle per-customer (gaya Murpati) — AI auto-balas hanya untuk convo yang ON.
alter table public.wa_conversations
  add column if not exists ai_enabled boolean not null default false;

comment on column public.wa_conversations.ai_enabled is
  'Toggle AI auto-reply untuk conversation ini. Lalai false. AI balas hanya bila master switch ON DAN ini true.';

-- Bezakan mesej yang dijana AI (+ simpan draf untuk mod draft).
alter table public.wa_messages
  add column if not exists ai_generated boolean not null default false;
alter table public.wa_messages
  add column if not exists ai_status text;  -- null | 'draft' | 'sent'

-- Tetapan global (key/value). ON CONFLICT DO NOTHING — jangan tindih nilai sedia ada.
insert into public.app_settings (key, value) values
  ('ai_chatbot_enabled', 'false'),     -- master kill switch (OFF lalai)
  ('ai_chatbot_mode',    'auto'),      -- auto | draft | faq
  ('ai_chatbot_model',   'gpt-4o-mini')-- model lalai (gpt-4o-mini | claude-haiku)
on conflict (key) do nothing;

-- Audit setiap panggilan AI — sumber analytics + "soalan tak terjawab".
create table if not exists public.wa_ai_log (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.wa_conversations(id) on delete set null,
  contact_id      uuid references public.wa_contacts(id) on delete set null,
  model           text,                          -- key model: gpt-4o-mini | claude-haiku
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  cost_usd        numeric(10,6) not null default 0,
  outcome         text not null default 'replied',-- replied | escalated | unanswered | error | skipped
  inbound_preview text,                          -- ringkasan mesej masuk (untuk semakan)
  created_at      timestamptz not null default now()
);
create index if not exists idx_wa_ai_log_created on public.wa_ai_log(created_at desc);
create index if not exists idx_wa_ai_log_outcome on public.wa_ai_log(outcome);

alter table public.wa_ai_log enable row level security;
drop policy if exists "wa_ai_log: admin" on public.wa_ai_log;
create policy "wa_ai_log: admin" on public.wa_ai_log
  for all using (public.is_admin()) with check (public.is_admin());
