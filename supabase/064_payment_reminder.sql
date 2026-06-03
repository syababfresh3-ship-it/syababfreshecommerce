-- 064: track when an abandoned-payment reminder email was sent for an unpaid
-- online (FPX / e-wallet) order, so the reminder cron never emails the same
-- customer twice. NULL = belum diingatkan. Distamp oleh
-- /api/cron/payment-reminder selepas email berjaya dihantar.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMPTZ;

ALTER TABLE public.lp_guest_orders
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMPTZ;
