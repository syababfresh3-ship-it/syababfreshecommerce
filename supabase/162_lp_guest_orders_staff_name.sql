-- 162: nama staf pada order LP/Quick Order — lajur berasingan dari `source`.
-- Punca: Quick Order hantar source 'whatsapp-<staf>' tetapi bila reseller dipilih, API timpa
-- source → 'reseller' (dipakai export kurier, loyalty, detail) dan nama staf (cth Mika) hilang
-- dari senarai Orders & tapisan Staf. Lajur ini additive; source TIDAK diubah.
alter table public.lp_guest_orders add column if not exists staff_name text;
comment on column public.lp_guest_orders.staff_name is 'Staf yang key-in order (Quick Order). Order borong kekal source=reseller.';

-- Backfill yang boleh diterbitkan: source 'whatsapp-<nama>' → staff_name.
update public.lp_guest_orders
   set staff_name = nullif(trim(substring(source from 10)), '')
 where source like 'whatsapp-%' and staff_name is null;
