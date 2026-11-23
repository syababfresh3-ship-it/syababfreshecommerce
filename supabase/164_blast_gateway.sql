-- 164: Blast melalui nombor TIDAK RASMI (gateway sendiri, cth Hijau) — cabang tambahan dalam Blaster CRM.
--
-- Official  : crm_blasts (template Meta) → crm_blast_recipients → lib/blast-drain (Cloud API)  — TIDAK DIUBAH.
-- Gateway   : crm_blasts (channel='gateway', message teks) → crm_blast_recipients (pending) → wa_outbox (satu baris
--             setiap penerima, scheduled_at berjarak 45s, had 140/hari, tetingkap 09:00–21:00) → drainer wa_outbox →
--             gateway (session dalam send_session_id) → status sent/delivered/read melalui webhook gateway → crm_blast_mark_status.
-- Jalankan SEBELUM deploy kod yang memakainya (POST blast gateway memerlukan lajur ini).

alter table public.crm_blasts
  add column if not exists channel text not null default 'official',   -- official | gateway
  add column if not exists message text;                                 -- teks bebas (gateway sahaja; token {nama}, {lajur_csv})

alter table public.wa_outbox
  add column if not exists blast_id        uuid,   -- kempen Blaster (gateway) yang memiliki baris ini
  add column if not exists recipient_id    uuid,   -- crm_blast_recipients.id — dikemas kini selepas hantar
  add column if not exists send_session_id text;   -- session gateway yang MESTI dipakai (bukan putaran MURPATI_SESSION_IDS)

create index if not exists wa_outbox_blast_idx on public.wa_outbox (blast_id) where blast_id is not null;

-- Kos blast gateway = 0 (tiada caj Meta) — ROAS tidak terpakai (null); hasil & order masih dikira.
-- Definisi sama seperti 084, hanya ungkapan `cost` ditambah syarat channel.
create or replace view public.crm_blast_roas as
with rate as (
  select coalesce(
    nullif((select value from app_settings where key = 'wa_marketing_msg_cost'), '')::numeric,
    0.11
  ) as per_msg
),
sent as (
  select blast_id, count(*)::int as sent_count
  from public.crm_blast_recipients
  where status in ('sent','delivered','read')
  group by blast_id
),
attr as (
  select blast_id,
         count(*)::int       as orders_attributed,
         sum(total)::numeric as revenue
  from public.crm_blast_order_attribution
  group by blast_id
)
select
  b.id                              as blast_id,
  b.name,
  b.template_name,
  b.created_at,
  coalesce(s.sent_count, 0)         as sent,
  coalesce(a.orders_attributed, 0)  as orders_attributed,
  coalesce(a.revenue, 0)::numeric   as revenue,
  (case when b.channel = 'gateway' then 0 else coalesce(s.sent_count, 0) * (select per_msg from rate) end)::numeric as cost,
  case when coalesce(s.sent_count, 0) > 0
       then round(coalesce(a.orders_attributed, 0)::numeric * 100.0 / s.sent_count, 2)
       else 0 end                   as conversion_rate,
  case when b.channel <> 'gateway' and coalesce(s.sent_count, 0) * (select per_msg from rate) > 0
       then round(coalesce(a.revenue, 0) / (s.sent_count * (select per_msg from rate)), 2)
       else null end                as roas
from public.crm_blasts b
left join sent s on s.blast_id = b.id
left join attr a on a.blast_id = b.id;

-- CREATE OR REPLACE VIEW reset reloptions → set semula (lihat AGENTS.md; 089 pernah set ini)
alter view public.crm_blast_roas set (security_invoker = on);
