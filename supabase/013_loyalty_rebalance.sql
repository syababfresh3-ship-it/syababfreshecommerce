-- Update loyalty tier thresholds and perks
-- New: Hijau RM0, Perak RM200, Emas RM500, Platinum RM1000
-- Points rate changed: 10 pts = RM1 (was 100 pts = RM1)

update public.loyalty_tiers set
  min_spend = 0,
  multiplier = 1.0,
  perks = 'Asas — 1 mata setiap RM1 belanja'
where name = 'Hijau';

update public.loyalty_tiers set
  min_spend = 200,
  multiplier = 1.5,
  perks = '1.5x mata + free delivery kredit RM5/bulan'
where name = 'Perak';

update public.loyalty_tiers set
  min_spend = 500,
  multiplier = 2.0,
  perks = '2x mata + priority packing + free delivery'
where name = 'Emas';

update public.loyalty_tiers set
  min_spend = 1000,
  multiplier = 3.0,
  perks = '3x mata + dedicated support + tawaran eksklusif'
where name = 'Platinum';
