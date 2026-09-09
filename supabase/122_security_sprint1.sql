-- ============================================================
-- 122_security_sprint1.sql — tutup lubang keselamatan (audit Sept 2026 §0)
--
-- 0.1  Pelanggan boleh update order sendiri (tanda paid/ubah total) → drop.
--      Cancel oleh pelanggan sudah lalu RPC cancel_order (semak pemilik).
-- 0.9  Pelanggan boleh insert loyalty_transactions sendiri → drop.
--      Semua insert loyalty dibuat di server (service role).
-- 0.4  Sesiapa (anon key) boleh insert lp_guest_orders & landing_page_leads
--      dengan harga sendiri → drop. Semua insert lalu API service role.
-- 0.2  Fungsi SECURITY DEFINER (increment_points, deduct_inventory, ...)
--      boleh dipanggil sesiapa via PostgREST → revoke dari anon/authenticated,
--      grant service_role. Disahkan: semua dipanggil dari server sahaja,
--      KECUALI cancel_order (user client, semak auth.uid()) dan is_admin (RLS).
-- 0.5  orders.finalized_at — tuntutan atomik /api/orders/[id]/finalize
--      (elak potong stok/mata berulang).
--
-- Idempotent — selamat dijalankan semula.
-- ============================================================

-- 0.1 / 0.9 / 0.4 ─ polisi RLS terlalu longgar
drop policy if exists "orders: user can update own"               on public.orders;
drop policy if exists "loyalty_transactions: user can insert own" on public.loyalty_transactions;
drop policy if exists "Public insert"                              on public.lp_guest_orders;
drop policy if exists "Public insert leads"                        on public.landing_page_leads;

-- 0.2 ─ fungsi server-sahaja: tarik balik dari awam, beri service_role
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'increment_points', 'increment_spend', 'increment_promo_uses',
        'deduct_inventory', 'deduct_variant_stock', 'increment_affiliate_balance',
        'kad_setia_add_stamp', 'kad_setia_redeem', 'increment_lp_view_count',
        'import_wa_contacts', 'upsert_external_customers',
        'crm_blast_claim', 'crm_blast_mark_status', 'crm_blaster_overview',
        'wa_has_recent_order', 'find_profile_by_phone', 'lp_orders_for_phone',
        'generate_invoice_number', 'generate_order_invoice_number', 'generate_lp_order_number'
      ])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- 0.5 ─ tanda finalize (COD / bank transfer) supaya tak boleh diulang
alter table public.orders add column if not exists finalized_at timestamptz;
