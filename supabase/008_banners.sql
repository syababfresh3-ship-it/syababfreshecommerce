create table if not exists banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  link        text default '/products',
  link_label  text default 'Beli Sekarang',
  bg_class    text default 'gradient-brand',
  is_active   boolean default true not null,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

alter table banners enable row level security;

create policy "banners readable by all" on banners for select using (true);
create policy "admins manage banners" on banners for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Default banner
insert into banners (title, subtitle, link, link_label, bg_class, is_active, sort_order)
values (
  'Diskaun 20% Buah Import',
  'Strawberry, Anggur, Epal — semua ada!',
  '/products?promo=1',
  'Beli Sekarang',
  'gradient-brand',
  true,
  0
);
