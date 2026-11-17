import { NextResponse } from 'next/server';
import { rateLimited, clientIp } from '@/lib/serverSupabase';
import { FEEDS, applyFullName, extractFullName, isLawPageUrl, isTruncated, lawBaseUrl, mergeNews, parseFeed, type NewsItem } from '@/lib/news';

// Právní novinky z veřejných kanálů RSS. Seznam zdrojů je pevný (žádná adresa od uživatele), odpověď se krátce drží v paměti serveru.
let cache: { at: number; items: NewsItem[] } | null = null;
const TTL_MS = 30 * 60_000;
// Úplné názvy předpisů se nemění, stačí je stáhnout jednou
const names = new Map<string, string>();

async function fullNames(items: NewsItem[]): Promise<NewsItem[]> {
    const todo = items.filter((i) => (i.kind === 'predpis' || i.kind === 'zneni' || i.kind === 'ucinne') && isTruncated(i.title) && isLawPageUrl(i.url) && !names.has(i.url)).slice(0, 60);
    await Promise.allSettled(todo.map(async (i) => {
        const res = await fetch(lawBaseUrl(i.url), { headers: { 'User-Agent': 'Kancelar/1.0 (RSS reader)' }, signal: AbortSignal.timeout(6000), cache: 'no-store' });
        if (res.ok) names.set(i.url, extractFullName((await res.text()).slice(0, 400_000)));
    }));
    return items.map((i) => applyFullName(i, names.get(i.url) ?? ''));
}

async function load(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(FEEDS.map(async (f) => {
        const res = await fetch(f.url, { headers: { 'User-Agent': 'Kancelar/1.0 (RSS reader)', Accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const xml = (await res.text()).slice(0, 1_500_000);
        return parseFeed(xml, f).slice(0, 25);
    }));
    return fullNames(mergeNews(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))));
}

export async function GET(req: Request) {
    if (rateLimited(`news:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    if (!cache || Date.now() - cache.at > TTL_MS) {
        const items = await load();
        // Při výpadku všech zdrojů zůstane starší odpověď
        if (items.length || !cache) cache = { at: Date.now(), items };
    }
    return NextResponse.json({ items: cache.items, updatedAt: new Date(cache.at).toISOString() }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
