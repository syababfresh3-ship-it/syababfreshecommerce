-- 167: Purchase pixel LP tembak SEKALI sahaja seumur hidup order.
-- Punca: page /lp/<slug>/berjaya tembak fbq('track','Purchase') setiap kali dibuka dalam sesi pelayar
-- baharu (penanda lama = sessionStorage). Meta TIDAK nyahganda salinan pelayar-sahaja (dok: "If you send us
-- two consecutive browser events with the same information, we do not discard either"), dan Purchase FPX LP
-- tiada pasangan CAPI → purchase & nilai dalam Ads Manager membengkak.
-- Pembetulan: penanda dalam DB (claim atomik `where pixel_purchase_at is null`) + CAPI Purchase pada
-- pengesahan bayaran (lib/order-confirm) dengan event_id sama → Meta nyahganda pelayar↔pelayan.
-- Kod toleran: lajur tiada → kelakuan lama (penanda sessionStorage). Idempoten.

alter table public.lp_guest_orders
  add column if not exists pixel_purchase_at timestamptz;

comment on column public.lp_guest_orders.pixel_purchase_at is
  'Masa Purchase pixel pelayar ditembak di page berjaya (sekali sahaja; null = belum). Migration 167.';
