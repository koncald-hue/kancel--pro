import { NextResponse } from 'next/server';
import { clientIp, rateLimited, serviceClient } from '@/lib/serverSupabase';
import { isAllowedUpload, isValidIntakeCode } from '@/lib/portal';
import { safeFileName } from '@/lib/caseFile';

const MAX_INQUIRY_FILES = 5;
const MAX_INQUIRY_FILE = 10 * 1024 * 1024;
const MAX_INQUIRY_TOTAL = 25 * 1024 * 1024;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Veřejná poptávka: budoucí klient popíše věc, advokát ji uvidí v kanceláři ve složce Poptávky
export async function POST(req: Request) {
    if (await rateLimited(`in:${clientIp(req)}`, 5, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    if (clean(form.get('website'), 200)) return NextResponse.json({ ok: true }); // past na roboty: pole, které člověk nevyplní
    const code = clean(form.get('code'), 40);
    const name = clean(form.get('name'), 120);
    const email = clean(form.get('email'), 160);
    const phone = clean(form.get('phone'), 40);
    const message = clean(form.get('message'), 3000);
    if (!isValidIntakeCode(code) || !name || message.length < 10 || (!email && !phone)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_INQUIRY_FILES) return NextResponse.json({ error: 'invalid', message: `Přiložit jde nejvýše ${MAX_INQUIRY_FILES} souborů.` }, { status: 400 });
    if (files.reduce((s, f) => s + f.size, 0) > MAX_INQUIRY_TOTAL) return NextResponse.json({ error: 'invalid', message: 'Přílohy jsou dohromady větší než 25 MB.' }, { status: 400 });
    for (const f of files) {
        const problem = isAllowedUpload(f.name, f.size);
        if (problem) return NextResponse.json({ error: 'invalid', message: `${f.name}: ${problem}` }, { status: 400 });
        if (f.size > MAX_INQUIRY_FILE) return NextResponse.json({ error: 'invalid', message: `${f.name}: soubor je větší než 10 MB.` }, { status: 400 });
    }

    const { data: lawyer } = await db.from('lawyer_access').select('user_id, status, until, verification_status').eq('intake_code', code).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    const active = lawyer && lawyer.verification_status === 'verified' && (lawyer.status === 'active' || lawyer.status === 'trial') && (!lawyer.until || String(lawyer.until) >= today);
    if (!active) return NextResponse.json({ error: 'notfound' }, { status: 404 });

    const { data: inquiry, error } = await db.from('lawyer_inquiries').insert({ user_id: lawyer.user_id, name, email, phone, message }).select('id').single();
    if (error || !inquiry) return NextResponse.json({ error: 'failed' }, { status: 500 });

    // Přílohy leží odděleně od spisu; do spisu je advokát přenese až přijetím poptávky
    const stored: string[] = [];
    for (const f of files) {
        const path = `${lawyer.user_id}/${inquiry.id}/${crypto.randomUUID()}-${safeFileName(f.name)}`;
        const up = await db.storage.from('inquiry-files').upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type || undefined });
        const row = up.error ? null : await db.from('inquiry_files').insert({ inquiry_id: inquiry.id, user_id: lawyer.user_id, name: f.name, path, size: f.size, mime: f.type }).select('id').single();
        if (up.error || !row || row.error) {
            console.warn('[intake] attachment failed:', up.error?.message ?? row?.error?.message);
            await db.storage.from('inquiry-files').remove([...stored, path]);
            await db.from('lawyer_inquiries').delete().eq('id', inquiry.id);
            return NextResponse.json({ error: 'failed' }, { status: 500 });
        }
        stored.push(path);
    }
    return NextResponse.json({ ok: true });
}

// Název kanceláře k zobrazení nad formulářem
export async function GET(req: Request) {
    if (await rateLimited(`ig:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
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
