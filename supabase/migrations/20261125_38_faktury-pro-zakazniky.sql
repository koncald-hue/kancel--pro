-- Zákazník (advokát) smí číst své vlastní faktury za předplatné. Cizí faktury ani účetnictví provozovatele nevidí.
drop policy if exists "own_select" on public.ops_invoices;
create policy "own_select" on public.ops_invoices for select to authenticated using (user_id = auth.uid());
