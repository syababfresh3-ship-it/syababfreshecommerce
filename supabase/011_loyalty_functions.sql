-- Increment/decrement loyalty points for a user
create or replace function increment_points(uid uuid, pts integer)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set total_points = greatest(0, total_points + pts)
  where id = uid;
end;
$$;

-- Increment total spend for a user
create or replace function increment_spend(uid uuid, amount numeric)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set total_spend = total_spend + amount
  where id = uid;
end;
$$;
