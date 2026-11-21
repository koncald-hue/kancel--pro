import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { fingerprint, isNoise, pagePath, scrub } from '@/lib/errorLog';

// Přijímá chyby z prohlížeče uživatelů a ukládá je pro Správu. Bez přihlášení, proto s limitem a čištěním textu.
export async function POST(req: Request) {
    if (await rateLimited(`log-error:${clientIp(req)}`, 20, 10 * 60_000)) return new NextResponse(null, { status: 204 });
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > 8000) return new NextResponse(null, { status: 204 });
    let body: { message?: unknown; stack?: unknown; page?: unknown; source?: unknown };
    try { body = await req.json(); } catch { return new NextResponse(null, { status: 204 }); }
    const rawMsg = typeof body.message === 'string' ? body.message : '';
    const rawStack = typeof body.stack === 'string' ? body.stack : '';
    if (isNoise(rawMsg, rawStack)) return new NextResponse(null, { status: 204 });
    const message = scrub(rawMsg, 500), stack = scrub(rawStack, 2000), page = pagePath(typeof body.page === 'string' ? body.page : '');
    const db = serviceClient();
    if (!db) return new NextResponse(null, { status: 204 });
    await db.from('app_errors').insert({ source: body.source === 'boundary' ? 'boundary' : 'client', message, stack, page, ua: (req.headers.get('user-agent') ?? '').slice(0, 200), fingerprint: fingerprint(message, page) });
    return new NextResponse(null, { status: 204 });
}
