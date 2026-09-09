-- ============================================================
-- 119_lp_videos_bucket.sql
-- Bucket awam untuk video Landing Page (section "Video Jualan":
-- pelanggan tonton video, tekan produk, bayar di page yang sama).
--
-- Berasingan dari brand-assets (had 5MB, gambar sahaja).
-- Had 50MB = default global file size limit projek Supabase; kalau nak
-- lebih, naikkan dulu di Dashboard > Storage > Settings.
-- Idempotent — selamat dijalankan semula.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lp-videos',
  'lp-videos',
  true,
  52428800,
  array['video/mp4', 'video/webm']
)
on conflict (id) do nothing;

-- Admin sahaja boleh upload / ganti / padam
drop policy if exists "Admin upload lp videos" on storage.objects;
create policy "Admin upload lp videos"
  on storage.objects for insert
  with check (bucket_id = 'lp-videos' and public.is_admin());

drop policy if exists "Admin update lp videos" on storage.objects;
create policy "Admin update lp videos"
  on storage.objects for update
  using (bucket_id = 'lp-videos' and public.is_admin());

drop policy if exists "Admin delete lp videos" on storage.objects;
create policy "Admin delete lp videos"
  on storage.objects for delete
  using (bucket_id = 'lp-videos' and public.is_admin());

-- Awam boleh tonton (LP terbuka tanpa login)
drop policy if exists "Public read lp videos" on storage.objects;
create policy "Public read lp videos"
  on storage.objects for select
  using (bucket_id = 'lp-videos');
