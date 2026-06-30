-- ============================================================
-- 098_wa_auto_followup.sql
-- Auto follow-up (Senario A): chat TERBUKA (customer dah reply, window 24j),
-- senyap, BELUM beli → hantar 1 nudge teks (free-form sah dlm window).
-- Off-by-default. ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- Bergantung pada wa_norm_phone (084) + lp_guest_orders/orders/profiles.
-- ============================================================

-- 1) Penanda "dah follow-up untuk stall ni" (di-null-kan semula bila customer mesej lagi).
alter table public.wa_conversations
  add column if not exists auto_followup_sent_at timestamptz;

-- Index separa untuk imbasan kelayakan murah.
create index if not exists idx_wa_conv_followup_due
  on public.wa_conversations (last_message_at)
  where needs_reply = true and auto_followup_sent_at is null;

-- 2) "Belum beli?" — true jika nombor ada order sah sejak p_since (LP + storefront).
--    Mirror dua-cabang crm_blast_order_attribution (090) guna wa_norm_phone.
create or replace function public.wa_has_recent_order(p_wa_id text, p_since timestamptz)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.lp_guest_orders o
    where public.wa_norm_phone(o.phone) = public.wa_norm_phone(p_wa_id)
      and o.status in ('confirmed','paid','preparing','delivering','delivered')
      and o.created_at >= p_since
    union all
    select 1 from public.orders o
    join public.profiles pr on pr.id = o.user_id
    where public.wa_norm_phone(pr.phone) = public.wa_norm_phone(p_wa_id)
      and o.status in ('confirmed','preparing','delivering','delivered')
      and o.created_at >= p_since
  );
$$;

-- 3) Seed setting (off-by-default). Tukar nilai kemudian dari Admin.
insert into app_settings (key, value) values
  ('auto_followup_enabled',     'false'),
  ('auto_followup_delay_hours', '4'),
  ('auto_followup_message',     'Hi *{name}*! 👋 Masih berminat dengan buah segar kami? Saya sedia bantu kalau ada apa-apa soalan 🌿'),
  ('auto_followup_daily_cap',   '100')
on conflict (key) do nothing;
