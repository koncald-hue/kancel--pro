-- Oprava ceny balíčku pro 20 advokátů (byla vyšší než u srovnatelného dodavatele): měsíc 7990, půl roku 43100 (-10 %), rok 76700 (-20 %).
insert into public.app_settings (key, value) values
  ('firm_price_20_month', '7990'), ('firm_price_20_half', '43100'), ('firm_price_20_year', '76700')
on conflict (key) do update set value = excluded.value;
