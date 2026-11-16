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

    // Propojení se spisem: údaje klienta se doplní do věci i do adresáře klientů advokáta (nic existujícího se nepřepisuje)
    const { data: caseRow } = await db.from('cases').select('client_name, client_email, client_phone, client_id').eq('id', link.case_id).maybeSingle();
    const caseFill: Record<string, string> = {};
    if (!caseRow?.client_name) caseFill.client_name = identity.name;
    if (!caseRow?.client_email && identity.email) caseFill.client_email = identity.email;
    if (!caseRow?.client_phone && identity.phone) caseFill.client_phone = identity.phone;
    if (Object.keys(caseFill).length) await db.from('cases').update(caseFill).eq('id', link.case_id);

    // Klient se hledá podle propojení věci, jinak podle jména
    type ClientRow = { id: string; email: string; phone: string; address: string | null };
    let existing = null as ClientRow | null;
    if (caseRow?.client_id) { const r = await db.from('lawyer_clients').select('id, email, phone, address').eq('id', caseRow.client_id).maybeSingle(); existing = r.data as ClientRow | null; }
    if (!existing) { const r = await db.from('lawyer_clients').select('id, email, phone, address').eq('user_id', link.user_id).ilike('name', identity.name).maybeSingle(); existing = r.data as ClientRow | null; }
    if (existing) {
        const fill: Record<string, string> = {};
        if (!existing.email && identity.email) fill.email = identity.email;
        if (!existing.phone && identity.phone) fill.phone = identity.phone;
        if (!existing.address && identity.address) fill.address = identity.address;
        if (Object.keys(fill).length) await db.from('lawyer_clients').update(fill).eq('id', existing.id);
        if (!caseRow?.client_id) await db.from('cases').update({ client_id: existing.id }).eq('id', link.case_id);
    } else {
        const { data: created } = await db.from('lawyer_clients').insert({ user_id: link.user_id, name: identity.name, email: identity.email, phone: identity.phone, address: identity.address, note: 'Z klientského odkazu' }).select('id').single();
        if (created && !caseRow?.client_id) await db.from('cases').update({ client_id: created.id }).eq('id', link.case_id);
    }

    return NextResponse.json({ ok: true });
}
