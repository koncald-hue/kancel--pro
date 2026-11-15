import { NextResponse } from 'next/server';
import { clientIp, findActiveLink, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { validateIdentity } from '@/lib/portal';

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Klient před vstupem do věci vyplní údaje o sobě a potvrdí souhlas; tím se mu odemkne spis
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    if (rateLimited(`id:${clientIp(req)}`, 20, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const link = await findActiveLink(db, token);
    if (!link) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    if (!link.verified) return NextResponse.json({ error: 'unverified' }, { status: 403 });
    if (!link.subscribed) return NextResponse.json({ error: 'inactive' }, { status: 403 });

    const body = await req.json().catch(() => null);
    const identity = { name: clean(body?.name, 120), email: clean(body?.email, 160), phone: clean(body?.phone, 40), address: clean(body?.address, 240), consent: body?.consent === true };
    const problem = validateIdentity(identity);
    if (problem) return NextResponse.json({ error: 'invalid', message: problem }, { status: 400 });

    const now = new Date().toISOString();
    const { error } = await db.from('client_links').update({ client_name: identity.name, client_email: identity.email, client_phone: identity.phone, client_address: identity.address, consent_at: now, onboarded_at: now }).eq('id', link.id);
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });

    // Propojení se spisem: jméno klienta ve věci a záznam v adresáři klientů advokáta
    const { data: caseRow } = await db.from('cases').select('client_name').eq('id', link.case_id).maybeSingle();
    if (!caseRow?.client_name) await db.from('cases').update({ client_name: identity.name }).eq('id', link.case_id);
    const { data: existing } = await db.from('lawyer_clients').select('id, email, phone').eq('user_id', link.user_id).ilike('name', identity.name).maybeSingle();
    if (existing) await db.from('lawyer_clients').update({ email: existing.email || identity.email, phone: existing.phone || identity.phone }).eq('id', existing.id);
    else await db.from('lawyer_clients').insert({ user_id: link.user_id, name: identity.name, email: identity.email, phone: identity.phone, note: 'Z klientského odkazu' });

    return NextResponse.json({ ok: true });
}
