-- =====================================================================
-- E-MAILY ZKUŠEBNÍM UŽIVATELŮM (po 2. a po 5. dni)
-- Spusť JEDNOU v Supabase: SQL Editor -> New query -> vložit -> Run. Jde spustit i opakovaně.
-- Sloupce si vede jen server (denní úloha); slouží k tomu, aby každý e-mail odešel nejvýš jednou.
-- =====================================================================
alter table public.lawyer_access add column if not exists nudge_day2_at timestamptz;
alter table public.lawyer_access add column if not exists nudge_day5_at timestamptz;
