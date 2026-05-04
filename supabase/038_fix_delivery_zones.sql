-- ============================================================
-- 038_fix_delivery_zones.sql
-- Buang delivery zones luar Klang Valley
-- Klang Valley = Selangor + W.P. Kuala Lumpur + W.P. Putrajaya
-- ============================================================

delete from public.delivery_zones
where state not in (
  'Selangor',
  'W.P. Kuala Lumpur',
  'W.P. Putrajaya'
);

-- Verify
-- select state, count(*) from delivery_zones group by state order by count desc;
