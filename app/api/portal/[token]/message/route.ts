import { NextResponse } from 'next/server';
import { clientIp, findActiveLink, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { secondFactorBlock, type FactorLink } from '@/lib/portalSession';

// Klient pošle advokátovi zprávu k věci
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    if (await rateLimited(`msg:${clientIp(req)}`, 20, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const link = await findActiveLink(db, token);
    if (!link) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    if (!link.verified) return NextResponse.json({ error: 'unverified' }, { status: 403 });
    if (!link.subscribed) return NextResponse.json({ error: 'inactive' }, { status: 403 });
    const block = await secondFactorBlock(db, link as FactorLink, req);
    if (block) return block;
    if (!(link as { onboarded_at?: string | null }).onboarded_at) return NextResponse.json({ error: 'not-onboarded' }, { status: 403 });

    const body = await req.json().catch(() => null);
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    const encrypted = text.startsWith('e1:');
    if (!text || text.length > (encrypted ? 8000 : 2000)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    // V šifrované věci se čitelné zprávy nepřijímají
    if (link.e2ee && !encrypted) return NextResponse.json({ error: 'invalid' }, { status: 400 });

    const { data, error } = await db.from('client_messages').insert({ case_id: link.case_id, user_id: link.user_id, from_client: true, body: text }).select('id, from_client, body, created_at').single();
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
    return NextResponse.json({ message: data });
}
