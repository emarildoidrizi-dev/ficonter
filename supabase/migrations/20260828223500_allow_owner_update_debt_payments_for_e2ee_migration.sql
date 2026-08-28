drop policy if exists "Users can update own debt payments" on public.debt_payments;

create policy "Users can update own debt payments"
on public.debt_payments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
