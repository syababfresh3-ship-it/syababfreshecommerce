create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "users manage own subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admins read subscriptions"
  on push_subscriptions for select
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));
