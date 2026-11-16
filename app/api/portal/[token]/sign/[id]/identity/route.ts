import { NextResponse } from 'next/server';
import { loadSignRequest, originOf, portalGuard } from '@/lib/signServer';
import { authorizeUrl, bankIdConfig, discover, randomToken } from '@/lib/bankid';
import { isExpired } from '@/lib/signing';

// Klient zahájí ověření totožnosti přes Bank iD; vrací adresu, na kterou ho prohlížeč přesměruje
export async function POST(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
    const { token, id } = await ctx.params;
    const g = await portalGuard(req, token, 'sgi', 15, 60 * 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const r = await loadSignRequest(db, link, id);
    if (!r || r.status !== 'pending' || isExpired(r) || r.identity_method !== 'bankid') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const cfg = bankIdConfig(originOf(req));
    if (!cfg) return NextResponse.json({ error: 'disabled' }, { status: 503 });
    try {
        const ep = await discover(cfg);
        const state = randomToken(); const nonce = randomToken(); const verifier = randomToken(48);
        const { error } = await db.from('identity_sessions').insert({ state, nonce, code_verifier: verifier, purpose: 'signature', ref_id: r.id, link_token: token });
        if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
        return NextResponse.json({ url: await authorizeUrl(cfg, ep, { state, nonce, verifier }) });
    } catch { return NextResponse.json({ error: 'failed' }, { status: 502 }); }
}
