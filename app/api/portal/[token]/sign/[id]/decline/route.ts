import { NextResponse } from 'next/server';
import { loadSignRequest, portalGuard } from '@/lib/signServer';

export async function POST(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
    const { token, id } = await ctx.params;
    const g = await portalGuard(req, token, 'sgd', 20, 60 * 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const r = await loadSignRequest(db, link, id);
    if (!r || r.status !== 'pending') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const body = await req.json().catch(() => null) as { reason?: unknown } | null;
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 400) : '';
    const { error } = await db.from('signature_requests').update({ status: 'declined', decline_reason: reason }).eq('id', r.id).eq('status', 'pending');
    return error ? NextResponse.json({ error: 'failed' }, { status: 500 }) : NextResponse.json({ declined: true });
}
