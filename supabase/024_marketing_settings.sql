-- ============================================================
-- 024: Marketing tracking settings (Meta Pixel + Google Ads)
-- ============================================================
INSERT INTO app_settings (key, value) VALUES
  ('meta_pixel_id',          ''),
  ('google_ads_id',          ''),
  ('google_ads_label',       ''),
  ('gtm_id',                 '')
ON CONFLICT (key) DO NOTHING;
