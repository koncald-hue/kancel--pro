import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { isValidIntakeCode } from '@/lib/portal';

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Veřejná poptávka: budoucí klient popíše věc, advokát ji uvidí v kanceláři ve složce Poptávky
export async function POST(req: Request) {
    if (rateLimited(`in:${clientIp(req)}`, 5, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

    const body = await req.json().catch(() => null);
    if (clean(body?.website, 200)) return NextResponse.json({ ok: true }); // past na roboty: pole, které člověk nevyplní
    const code = clean(body?.code, 40);
    const name = clean(body?.name, 120);
    const email = clean(body?.email, 160);
    const phone = clean(body?.phone, 40);
    const message = clean(body?.message, 3000);
    if (!isValidIntakeCode(code) || !name || message.length < 10 || (!email && !phone)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

    const { data: lawyer } = await db.from('lawyer_access').select('user_id, status, until, verification_status').eq('intake_code', code).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    const active = lawyer && lawyer.verification_status === 'verified' && (lawyer.status === 'active' || lawyer.status === 'trial') && (!lawyer.until || String(lawyer.until) >= today);
    if (!active) return NextResponse.json({ error: 'notfound' }, { status: 404 });

    const { error } = await db.from('lawyer_inquiries').insert({ user_id: lawyer.user_id, name, email, phone, message });
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
}

// Název kanceláře k zobrazení nad formulářem
export async function GET(req: Request) {
    if (rateLimited(`ig:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const code = clean(new URL(req.url).searchParams.get('code'), 40);
    if (!isValidIntakeCode(code)) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    const { data } = await db.from('lawyer_access').select('firm_name, status, until, verification_status').eq('intake_code', code).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    const active = data && data.verification_status === 'verified' && (data.status === 'active' || data.status === 'trial') && (!data.until || String(data.until) >= today);
    if (!active) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    return NextResponse.json({ firm: (data.firm_name as string) || '' });
}
