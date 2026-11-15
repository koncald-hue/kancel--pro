import { createClient } from '@supabase/supabase-js';

// Zástupné hodnoty umožní web sestavit a spustit i bez nastaveného Supabase (data se pak jen nenačtou)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Jediný klient Supabase pro celý web (prohlížeč i server)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
