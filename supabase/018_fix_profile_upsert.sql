-- Allow users to insert their own profile row (for upsert to work when trigger failed)
create policy "profiles: user can insert own"
  on public.profiles for insert
  with check (id = auth.uid() and is_admin = false);
