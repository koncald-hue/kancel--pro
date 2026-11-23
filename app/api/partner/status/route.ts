import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';

// Stav poptávek podle tajných značek, které zná jen Studuj právo (statistika poradny). Vrací jen stav, žádné údaje.
export async function GET(req: Request) {
    if (await rateLimited(`pst:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const refs = (new URL(req.url).searchParams.get('refs') ?? '').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{16,64}$/.test(s)).slice(0, 100);
    if (!refs.length) return NextResponse.json({ statuses: {} });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const { data, error } = await db.from('lawyer_inquiries').select('source_ref, status').eq('source', 'studujpravo').in('source_ref', refs);
    if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const statuses: Record<string, string[]> = {};
    for (const r of (data ?? []) as { source_ref: string; status: string }[]) (statuses[r.source_ref] ??= []).push(r.status);
    return NextResponse.json({ statuses }, { headers: { 'Cache-Control': 'no-store' } });
}
