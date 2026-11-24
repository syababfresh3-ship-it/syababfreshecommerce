-- 168: Pejabat AI (/admin/pejabat) — status langsung setiap "staf AI" (chatbot, routine/cron, agen Hermes di VPS,
-- Claude Code). Satu baris setiap agen; dikemas kini oleh pelapor masing-masing melalui POST /api/office/status
-- (Bearer CRON_SECRET) atau terus dari kod pelayan (lib/office.ts setAgentStatus). Dashboard hanya membaca.
-- Senarai staf (roster) & peranan ditakrif dalam kod (lib/office.ts); jadual ini hanya keadaan semasa.
-- Akses: service_role sahaja (RLS deny-all). Idempoten.

create table if not exists public.ai_agent_status (
  agent_key  text primary key,                         -- 'aina' | 'nurul' | 'alis' | 'man' | 'mira' | 'ahmad' | …
  name       text,
  role       text,
  state      text not null default 'idle' check (state in ('working', 'idle', 'waiting', 'offline')),
  task       text,                                     -- ringkasan tugasan semasa (≤ 200 aksara)
  since      timestamptz,                              -- bila keadaan semasa bermula
  last_seen  timestamptz not null default now(),
  meta       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ai_agent_status enable row level security;
-- Tiada polisi = deny-all untuk anon/authenticated; service role sahaja.

comment on table public.ai_agent_status is
  'Status langsung staf AI untuk /admin/pejabat (migration 168). Ditulis oleh pelapor (POST /api/office/status / lib/office.ts).';
