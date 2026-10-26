-- ============================================================
-- 151_product_knowledge.sql
-- Fasa 2 "cerdikkan chatbot" (docs/plan-ai-chatbot-cerdik.md): fakta buah berstruktur per produk
-- + FAQ umum berkategori. AI chatbot hanya guna fakta berstatus 'verified' (disahkan manusia).
-- Draf dijana AI dari penerangan produk → admin semak & sahkan di /admin/crm/ai/knowledge.
-- ADDITIVE. Idempotent. Tidak sentuh jadual products.
-- ============================================================
create table if not exists public.product_knowledge (
  product_id   uuid primary key references public.products(id) on delete cascade,
  facts        jsonb not null default '{}',        -- {asal, musim, rasa, tekstur, biji, cara_simpan, tempoh_tahan, tanda_masak, cara_makan, beza_gred, kesihatan, faq:[{q,a}]}
  status       text not null default 'draft' check (status in ('draft', 'verified')),
  source       text,                                -- ai | manual
  drafted_at   timestamptz,
  verified_at  timestamptz,
  verified_by  text,
  updated_at   timestamptz not null default now(),
  updated_by   text
);
create index if not exists product_knowledge_status_idx on public.product_knowledge (status);
comment on table public.product_knowledge is 'Fakta buah untuk AI chatbot. Hanya status=verified diberi kepada AI.';

create table if not exists public.ai_faq (
  id          uuid primary key default gen_random_uuid(),
  category    text,                                 -- cth Penghantaran, Kualiti, Kurma, Pembayaran
  question    text not null,
  answer      text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text
);
create index if not exists ai_faq_active_idx on public.ai_faq (is_active, sort_order);
comment on table public.ai_faq is 'FAQ umum (disahkan admin) yang disuntik ke system prompt chatbot WA.';

alter table public.product_knowledge enable row level security;
alter table public.ai_faq enable row level security;
drop policy if exists product_knowledge_admin on public.product_knowledge;
create policy product_knowledge_admin on public.product_knowledge
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
drop policy if exists ai_faq_admin on public.ai_faq;
create policy ai_faq_admin on public.ai_faq
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
