-- ── 028_affiliates.sql ────────────────────────────────────────────────────────
-- Affiliate program: cash commission tracking + withdrawal requests

-- 1. Affiliate flag + balance on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_affiliate   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affiliate_balance numeric(10,2) NOT NULL DEFAULT 0;

-- 2. Commission rate in app_settings (1% default)
INSERT INTO public.app_settings (key, value)
  VALUES ('affiliate_commission_pct', '0.01')
  ON CONFLICT (key) DO NOTHING;

-- 3. Affiliate commissions table
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id     uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_total  numeric(10,2) NOT NULL,
  rate         numeric(5,4) NOT NULL,
  amount       numeric(10,2) NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'paid')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (affiliate_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_aff_comm_affiliate ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_aff_comm_order     ON public.affiliate_commissions(order_id);

-- 4. Withdrawal requests table
CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       numeric(10,2) NOT NULL,
  bank_name    text NOT NULL,
  bank_account text NOT NULL,
  account_name text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_note   text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_aff_wd_affiliate ON public.affiliate_withdrawals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_aff_wd_status    ON public.affiliate_withdrawals(status);

-- 5. RLS
ALTER TABLE public.affiliate_commissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate sees own commissions"   ON public.affiliate_commissions;
DROP POLICY IF EXISTS "admin all commissions"            ON public.affiliate_commissions;
DROP POLICY IF EXISTS "affiliate sees own withdrawals"   ON public.affiliate_withdrawals;
DROP POLICY IF EXISTS "affiliate inserts own withdrawal" ON public.affiliate_withdrawals;
DROP POLICY IF EXISTS "admin all withdrawals"            ON public.affiliate_withdrawals;

CREATE POLICY "affiliate sees own commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (affiliate_id = auth.uid() OR public.is_admin());

CREATE POLICY "admin all commissions"
  ON public.affiliate_commissions FOR ALL
  USING (public.is_admin());

CREATE POLICY "affiliate sees own withdrawals"
  ON public.affiliate_withdrawals FOR SELECT
  USING (affiliate_id = auth.uid() OR public.is_admin());

CREATE POLICY "affiliate inserts own withdrawal"
  ON public.affiliate_withdrawals FOR INSERT
  WITH CHECK (affiliate_id = auth.uid());

CREATE POLICY "admin all withdrawals"
  ON public.affiliate_withdrawals FOR ALL
  USING (public.is_admin());

-- 6. RPC to safely increment affiliate balance
CREATE OR REPLACE FUNCTION increment_affiliate_balance(uid uuid, amt numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.profiles
  SET affiliate_balance = affiliate_balance + amt
  WHERE id = uid;
$$;
