-- O přístup do Kanceláře zdarma už nejde žádat: sám si uživatel může založit jen zkušební přístup na 14 dní.
-- Přístup zdarma dává jen správce (Správa → Advokáti a předplatné).

drop policy if exists "lawyer_access_insert" on public.lawyer_access;
create policy "lawyer_access_insert" on public.lawyer_access for insert with check (
  auth.uid() = user_id
  and status = 'trial'
  and until <= current_date + 14
);

-- Dřívější nevyřízené žádosti se smažou, aby si tito uživatelé mohli spustit běžný zkušební přístup
delete from public.lawyer_access where status = 'requested';
