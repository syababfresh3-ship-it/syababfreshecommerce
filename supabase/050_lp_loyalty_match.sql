-- ============================================================
-- 050_lp_loyalty_match.sql
-- Bagi loyalty points untuk pembelian LP bila telefon pembeli
-- sepadan dengan profil berdaftar.
--   1. find_profile_by_phone() — match telefon (normalize: 9 digit terakhir)
--   2. lp_guest_orders.loyalty_awarded — flag idempotency (elak double-award)
-- ============================================================

-- Match profil ikut telefon. Normalize: buang semua bukan-digit, banding 9 digit
-- terakhir (selesaikan format 0XX / +60XX / 60XX / ada dash & space).
create or replace function public.find_profile_by_phone(p_phone text)
returns table(id uuid, multiplier numeric)
language sql stable as $$
  select p.id, coalesce(t.multiplier, 1)::numeric as multiplier
  from public.profiles p
  left join public.loyalty_tiers t on t.id = p.tier_id
  where length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) >= 9
    and right(regexp_replace(p.phone, '\D', '', 'g'), 9)
      = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)
  limit 1;
$$;

-- Flag supaya points hanya diberi sekali setiap order (webhook / verify / delivered)
alter table public.lp_guest_orders
  add column if not exists loyalty_awarded boolean not null default false;
