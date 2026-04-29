-- ============================================================
-- 030: WhatsApp marketing opt-in field on profiles
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_optin boolean NOT NULL DEFAULT true;
