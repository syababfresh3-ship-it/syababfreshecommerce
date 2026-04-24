create table if not exists product_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now(),
  unique(product_id, user_id, order_id)
);

alter table product_reviews enable row level security;

-- Anyone can read reviews
create policy "reviews readable by all"
  on product_reviews for select using (true);

-- Only the reviewer can insert their own review
create policy "user can insert own review"
  on product_reviews for insert
  with check (auth.uid() = user_id);

-- Only the reviewer can delete their own review
create policy "user can delete own review"
  on product_reviews for delete
  using (auth.uid() = user_id);
