create table if not exists wishlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_id, product_id)
);

alter table wishlists enable row level security;

create policy "users manage own wishlist"
  on wishlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
