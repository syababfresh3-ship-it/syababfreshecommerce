-- Create brand-assets storage bucket for logo and other brand files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/svg+xml']
)
on conflict (id) do nothing;

-- Admin-only upload
create policy "Admin upload brand assets"
  on storage.objects for insert
  with check (bucket_id = 'brand-assets' and public.is_admin());

-- Admin-only update/replace
create policy "Admin update brand assets"
  on storage.objects for update
  using (bucket_id = 'brand-assets' and public.is_admin());

-- Public read (logo must be publicly accessible)
create policy "Public read brand assets"
  on storage.objects for select
  using (bucket_id = 'brand-assets');
