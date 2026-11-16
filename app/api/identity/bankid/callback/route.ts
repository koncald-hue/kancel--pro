import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/serverSupabase';
import { bankIdConfig, discover, exchangeCode, identityComplete } from '@/lib/bankid';
import { originOf } from '@/lib/signServer';

// Návrat z Bank iD: ověří se stav, vymění kód za údaje o totožnosti a výsledek se uloží k žádosti o podpis nebo identifikaci
export async function GET(req: Request) {
    const url = new URL(req.url);
    const origin = originOf(req);
    const back = (token: string, status: string, extra = '') => NextResponse.redirect(`${origin}/klient/${token}?identita=${status}${extra}`, 302);
    const state = url.searchParams.get('state') ?? ''; const code = url.searchParams.get('code') ?? '';
    const db = serviceClient();
    if (!db || !state) return NextResponse.redirect(`${origin}/`, 302);
    const { data: s } = await db.from('identity_sessions').select('id, code_verifier, purpose, ref_id, link_token, verified_at, created_at').eq('state', state).maybeSingle();
    if (!s || s.verified_at || Date.now() - new Date(s.created_at as string).getTime() > 15 * 60_000) return NextResponse.redirect(`${origin}/`, 302);
    const token = s.link_token as string;
    const extra = s.purpose === 'signature' ? `&podpis=${s.ref_id}` : `&aml=${s.ref_id}`;
    if (url.searchParams.get('error') || !code) return back(token, 'zruseno', extra);
    const cfg = bankIdConfig(origin);
    if (!cfg) return back(token, 'chyba', extra);
    try {
        const identity = await exchangeCode(cfg, await discover(cfg), code, s.code_verifier as string);
        if (!identityComplete(identity, cfg.provider)) return back(token, 'neuplne', extra);
        const now = new Date().toISOString();
        await db.from('identity_sessions').update({ result: { ...identity, provider: cfg.label }, verified_at: now }).eq('id', s.id);
        if (s.purpose === 'aml') {
            await db.from('client_identifications').update({ status: 'verified_online', method: 'bankid', online_result: { ...identity, provider: cfg.label, verifiedAt: now }, full_name: `${identity.given} ${identity.family}`, birth_date: identity.birthdate, address: identity.address }).eq('id', s.ref_id).eq('status', 'requested');
        }
        return back(token, 'ok', extra);
    } catch { return back(token, 'chyba', extra); }
}
