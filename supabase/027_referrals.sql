-- ── 027_referrals.sql ────────────────────────────────────────────────────────
-- Referral tracking: codes, reward on first qualifying order

-- 1. Add referral_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code varchar(8) UNIQUE;

-- 2. Function: derive code from profile id (6 hex chars, uppercase)
CREATE OR REPLACE FUNCTION generate_referral_code(uid uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT upper(substring(replace(uid::text, '-', ''), 1, 6))
$$;

-- 3. Trigger: auto-set code on new profile row
CREATE OR REPLACE FUNCTION trg_fn_set_referral_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_referral_code ON public.profiles;
CREATE TRIGGER trg_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_set_referral_code();

-- 4. Backfill existing profiles
UPDATE public.profiles
SET referral_code = generate_referral_code(id)
WHERE referral_code IS NULL;

-- 5. Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'rewarded')),
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  referee_pts  integer NOT NULL DEFAULT 50,
  referrer_pts integer NOT NULL DEFAULT 100,
  rewarded_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee  ON public.referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status   ON public.referrals(status);

-- 6. RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals: user sees own" ON public.referrals;
CREATE POLICY "referrals: user sees own"
  ON public.referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "referrals: admin all" ON public.referrals;
CREATE POLICY "referrals: admin all"
  ON public.referrals FOR ALL
  USING (public.is_admin());

-- service role bypasses RLS for insert/update from API routes
