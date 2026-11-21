import { cacheLife, cacheTag } from 'next/cache';
import { serviceClient } from './serverSupabase';
import { EMPTY_PRICES, type Prices } from './plans';
import type { Review } from './testimonials';

// Veřejná data pro úvodní stránku se čtou na serveru a ukládají do mezipaměti, aby se ceny a recenze
// ukázaly hned s první podobou stránky (bez načítání a bez „Brzy“).
export async function getPublicPrices(): Promise<Prices> {
    'use cache';
    cacheLife('minutes');
    cacheTag('public-prices');
    const db = serviceClient();
    if (!db) return EMPTY_PRICES;
    const { data } = await db.from('app_settings').select('key, value').in('key', ['lawyer_price_month', 'lawyer_price_half', 'lawyer_price_year']);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key as string, Number(r.value) || 0]));
    return { month: map.lawyer_price_month ?? 0, half: map.lawyer_price_half ?? 0, year: map.lawyer_price_year ?? 0 };
}

// Schválené recenze (nejnovější první); bez tabulky nebo bez schválených vrací prázdný seznam
export async function getApprovedReviews(limit = 6): Promise<Review[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('public-reviews');
    const db = serviceClient();
    if (!db) return [];
    const { data, error } = await db.from('testimonials').select('id, rating, body, display_name, role_label, status, created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(limit);
    return error ? [] : ((data ?? []) as Review[]);
}
