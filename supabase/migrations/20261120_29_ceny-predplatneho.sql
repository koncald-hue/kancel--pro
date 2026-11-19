-- Ceny předplatného (Kč, bez DPH). Jednotlivec: měsíc 649, půl roku 3500 (583/měs, -10 %), rok 6200 (517/měs, -20 %).
-- Balíčky pro kanceláře: 3 / 5 / 10 advokátů, stejné slevy. Ceny lze kdykoli změnit stejným příkazem.
insert into public.app_settings (key, value) values
  ('lawyer_price_month', '649'), ('lawyer_price_half', '3500'), ('lawyer_price_year', '6200'),
  ('firm_price_3_month', '1690'), ('firm_price_3_half', '9100'), ('firm_price_3_year', '16200'),
  ('firm_price_5_month', '2790'), ('firm_price_5_half', '15000'), ('firm_price_5_year', '26800'),
  ('firm_price_10_month', '5490'), ('firm_price_10_half', '29600'), ('firm_price_10_year', '52700')
on conflict (key) do update set value = excluded.value;
