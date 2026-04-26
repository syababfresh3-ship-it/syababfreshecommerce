-- Fix 1: Allow users to insert their own loyalty transactions
create policy "loyalty_transactions: user can insert own"
  on public.loyalty_transactions for insert
  with check (user_id = auth.uid());

-- Fix 2: Allow users to update their own orders (for cancel button)
create policy "orders: user can update own"
  on public.orders for update
  using (user_id = auth.uid() and status in ('pending', 'confirmed'));
