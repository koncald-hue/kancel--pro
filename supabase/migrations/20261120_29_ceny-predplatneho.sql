-- Ceny předplatného (Kč, bez DPH). Jednotlivec: měsíc 590, půl roku 3000 (500/měs), rok 5400 (450/měs).
-- Balíčky pro kanceláře: 3 / 5 / 10 advokátů. Ceny je možné kdykoli změnit stejným příkazem.
insert into public.app_settings (key, value) values
  ('lawyer_price_month', '590'), ('lawyer_price_half', '3000'), ('lawyer_price_year', '5400'),
  ('firm_price_3_month', '1390'), ('firm_price_3_half', '7000'), ('firm_price_3_year', '12700'),
  ('firm_price_5_month', '2290'), ('firm_price_5_half', '11600'), ('firm_price_5_year', '21000'),
  ('firm_price_10_month', '4490'), ('firm_price_10_half', '22800'), ('firm_price_10_year', '41000')
on conflict (key) do update set value = excluded.value;
