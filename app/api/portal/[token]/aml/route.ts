import { NextResponse } from 'next/server';
import { originOf, portalGuard } from '@/lib/signServer';
import { authorizeUrl, bankIdConfig, discover, randomToken } from '@/lib/bankid';

// Klient vidí žádost advokáta o ověření totožnosti (identifikace podle zákona o AML)
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    const g = await portalGuard(req, token, 'amg', 60, 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const { data, error } = await db.from('client_identifications').select('id, status').eq('case_id', link.case_id).eq('method', 'bankid').in('status', ['requested', 'verified_online', 'confirmed']).order('created_at', { ascending: false }).limit(1);
    if (error) return NextResponse.json({ request: null, bankid: false });
    return NextResponse.json({ request: data?.[0] ?? null, bankid: !!bankIdConfig('https://x') });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    const g = await portalGuard(req, token, 'amp', 15, 60 * 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const { data: row } = await db.from('client_identifications').select('id').eq('case_id', link.case_id).eq('method', 'bankid').eq('status', 'requested').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!row) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const cfg = bankIdConfig(originOf(req));
    if (!cfg) return NextResponse.json({ error: 'disabled' }, { status: 503 });
    try {
        const ep = await discover(cfg);
        const state = randomToken(); const nonce = randomToken(); const verifier = randomToken(48);
        const { error } = await db.from('identity_sessions').insert({ state, nonce, code_verifier: verifier, purpose: 'aml', ref_id: row.id, link_token: token });
        if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
        return NextResponse.json({ url: await authorizeUrl(cfg, ep, { state, nonce, verifier }) });
    } catch { return NextResponse.json({ error: 'failed' }, { status: 502 }); }
}
