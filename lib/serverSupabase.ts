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

// Atomic shared rate limits for serverless instances. The in-memory fallback is development-only.
const localHits = new Map<string, { count: number; resetAt: number }>();
function localRateLimited(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    if (localHits.size > 3000) for (const [k, v] of localHits) if (v.resetAt < now) localHits.delete(k);
    const entry = localHits.get(key);
    if (!entry || entry.resetAt < now) { localHits.set(key, { count: 1, resetAt: now + windowMs }); return false; }
    entry.count += 1;
    return entry.count > limit;
}

export async function rateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
    if (!key || key.length > 240 || !Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1000) return true;
    const db = serviceClient();
    if (!db) return process.env.NODE_ENV === 'production' ? true : localRateLimited(key, limit, windowMs);
    try {
        const { data, error } = await db.rpc('check_api_rate_limit', { p_key: key, p_limit: limit, p_window_ms: Math.ceil(windowMs) });
        if (error || typeof data !== 'boolean') return process.env.NODE_ENV === 'production' ? true : localRateLimited(key, limit, windowMs);
        return data;
    } catch {
        return process.env.NODE_ENV === 'production' ? true : localRateLimited(key, limit, windowMs);
    }
}

// IP adresa pro limity požadavků. Spoléhá na hlavičky, které nastavuje hosting (Vercel: x-real-ip /
// x-vercel-forwarded-for, ostatní proxy x-forwarded-for). Bez důvěryhodné proxy před aplikací jde IP podvrhnout,
// proto citlivé operace (kódy, podpisy) mají navíc limity vázané na odkaz nebo žádost, ne jen na IP.
export const clientIp = (req: Request) => {
    const h = req.headers;
    const ip = h.get('x-real-ip') || h.get('x-vercel-forwarded-for')?.split(',')[0] || h.get('x-forwarded-for')?.split(',')[0] || '';
    return ip.trim().slice(0, 64) || 'unknown';
};
