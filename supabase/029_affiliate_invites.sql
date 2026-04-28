-- ── 029_affiliate_invites.sql ─────────────────────────────────────────────────
-- One-time affiliate invite tokens

CREATE TABLE IF NOT EXISTS public.affiliate_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at     timestamptz,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aff_inv_token ON public.affiliate_invites(token);

ALTER TABLE public.affiliate_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages invites" ON public.affiliate_invites;
CREATE POLICY "admin manages invites"
  ON public.affiliate_invites FOR ALL
  USING (public.is_admin());

-- Anyone can read an invite by token (for validation)
DROP POLICY IF EXISTS "public read invite by token" ON public.affiliate_invites;
CREATE POLICY "public read invite by token"
  ON public.affiliate_invites FOR SELECT
  USING (true);
