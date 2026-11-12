-- 160: Peraturan promo setempat per landing page (lib/lp-promo-rules.ts)
-- Untuk promo komuniti (cth. /lp/bangi): harga khas LP sahaja, poskod dibenarkan, caj hantar rata,
-- minimum order, had percuma, slot hantar, hadiah automatik dan kuota "N unit pertama".
-- Slot & hadiah direkod dalam lp_guest_orders.notes (awalan [Slot] / [Hadiah]) — tiada lajur baharu.

alter table public.landing_pages add column if not exists promo_rules jsonb;

comment on column public.landing_pages.promo_rules is
  'Promo setempat LP: {enabled, postcodes[], flat_fee, min_subtotal, free_min, slots[], gift_pickup, gift_min, gift_min_label, prices{slug|slug:variasi: RM}, quotas{slug: unit}}. null = tiada.';
