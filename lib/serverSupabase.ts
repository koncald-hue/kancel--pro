import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isLinkActive, isValidToken } from './portal';

// Klient s plným přístupem k databázi. Používá se VÝHRADNĚ na serveru (API trasy klientského odkazu),
// nikdy se neposílá do prohlížeče. Klíč musí být v SUPABASE_SERVICE_ROLE_KEY (soubor .env.local).
export function serviceClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type LinkRow = { id: string; case_id: string; user_id: string; token: string; label: string; status_text: string; expires_at: string | null; revoked: boolean; opens: number; e2ee?: boolean; verified: boolean; subscribed: boolean; profession: string; verified_at: string | null; bar_number: string };

// Najde platný klientský odkaz podle tokenu; jinak null (volající vrací obecné 404)
export async function findActiveLink(db: SupabaseClient, token: string): Promise<LinkRow | null> {
    if (!isValidToken(token)) return null;
    const { data } = await db.from('client_links').select('*').eq('token', token).maybeSingle();
    if (!data || !isLinkActive(data as LinkRow)) return null;
    // Klientský odkaz funguje jen u advokáta, jehož totožnost ověřil tým (ochrana proti vydávání se za advokáta)
    const { data: lawyer } = await db.from('lawyer_access').select('verification_status, profession, verified_at, bar_number, status, until').eq('user_id', data.user_id).maybeSingle();
    return { ...(data as object), verified: lawyer?.verification_status === 'verified', subscribed: !!lawyer && (lawyer.status === 'active' || lawyer.status === 'trial') && (!lawyer.until || String(lawyer.until) >= new Date().toISOString().slice(0, 10)), profession: (lawyer?.profession as string) ?? 'advokat', verified_at: (lawyer?.verified_at as string | null) ?? null, bar_number: (lawyer?.bar_number as string) ?? '' } as LinkRow;
}

// Jednoduchý limit počtu požadavků (jen v paměti běžícího serveru)
const hits = new Map<string, { count: number; resetAt: number }>();
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    if (hits.size > 3000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) { hits.set(key, { count: 1, resetAt: now + windowMs }); return false; }
    entry.count += 1;
    return entry.count > limit;
}

export const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
