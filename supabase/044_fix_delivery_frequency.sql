-- ============================================================
-- 044_fix_delivery_frequency.sql
-- Simplify frekuensi penghantaran:
-- Lembah Klang (Selangor, KL, Putrajaya) → Harian
-- Luar Lembah Klang → 1-3 Hari Bekerja
-- ============================================================

-- Lembah Klang → Harian
update public.delivery_zones
set frequency = 'Harian'
where state in ('Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya');

-- Luar Lembah Klang → 1-3 Hari Bekerja
update public.delivery_zones
set frequency = '1-3 Hari Bekerja'
where state not in ('Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya');
