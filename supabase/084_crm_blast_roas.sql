-- ============================================================
-- 084_crm_blast_roas.sql
-- Blast ROAS (attribution owned-media; BUKAN iklan Meta).
-- Order berbayar dikira kepada blast PALING TERKINI yang penerimanya
-- (wa_id) padan nombor order & sent_at <= order.created_at <= sent_at + 7 hari.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

-- Kos per mesej marketing WhatsApp (MYR). Tukar kalau rate sebenar berbeza.
insert into app_settings (key, value) values ('wa_marketing_msg_cost', '0.11')
  on conflict (key) do nothing;

-- Normalize nombor — mirror formatWaPhone (lib/whatsapp-cloud.ts):
--   buang bukan-digit; 0xxxx -> 60xxxx; bare local -> 60xxxx.
-- Supaya lp_guest_orders.phone padan crm_blast_recipients.wa_id.
create or replace function public.wa_norm_phone(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when regexp_replace(p, '\D', '', 'g') = '' then null
    when regexp_replace(p, '\D', '', 'g') like '0%'
      then '60' || substring(regexp_replace(p, '\D', '', 'g') from 2)
    when regexp_replace(p, '\D', '', 'g') like '60%'
      then regexp_replace(p, '\D', '', 'g')
    else '60' || regexp_replace(p, '\D', '', 'g')
  end;
$$;

-- Attribution per-order: 1 baris per order berbayar yang boleh dikira ke blast.
-- DISTINCT ON (order) + order by sent_at desc = last-touch, tiada double-count.
create or replace view public.crm_blast_order_attribution as
select distinct on (o.id)
  o.id            as order_id,
  o.order_number,
  o.total,
  o.created_at    as order_created_at,
  r.blast_id,
  r.wa_id,
  r.sent_at       as blast_sent_at
from public.lp_guest_orders o
join public.crm_blast_recipients r
  on public.wa_norm_phone(r.wa_id) = public.wa_norm_phone(o.phone)
 and r.status in ('sent','delivered','read')
 and r.sent_at is not null
 and o.created_at >= r.sent_at
 and o.created_at <= r.sent_at + interval '7 days'
where o.status in ('confirmed','paid')
order by o.id, r.sent_at desc;

-- Rollup ROAS per blast.
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
  (coalesce(s.sent_count, 0) * (select per_msg from rate))::numeric as cost,
  case when coalesce(s.sent_count, 0) > 0
       then round(coalesce(a.orders_attributed, 0)::numeric * 100.0 / s.sent_count, 2)
       else 0 end                   as conversion_rate,
  case when coalesce(s.sent_count, 0) * (select per_msg from rate) > 0
       then round(coalesce(a.revenue, 0) / (s.sent_count * (select per_msg from rate)), 2)
       else null end                as roas
from public.crm_blasts b
left join sent s on s.blast_id = b.id
left join attr a on a.blast_id = b.id;
