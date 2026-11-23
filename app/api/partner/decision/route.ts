import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited, serviceClient } from '@/lib/serverSupabase';
import { decisionMail } from '@/lib/directory';
import { mailConfigured, sendMail } from '@/lib/mail';

// Advokát přijal nebo odmítl poptávku ze Studuj právo: zájemce dostane e-mail (při odmítnutí s odkazem na jiné advokáty).
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder', { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (await rateLimited(`pdc:${u.user.id}`, 60, 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const body = await req.json().catch(() => null) as { id?: unknown } | null;
    const id = typeof body?.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : '';
    if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const { data: q } = await db.from('lawyer_inquiries').select('id, user_id, name, email, status, source, area, region, decided_at').eq('id', id).maybeSingle();
    if (!q || q.user_id !== u.user.id) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    if (q.source !== 'studujpravo' || q.decided_at || (q.status !== 'accepted' && q.status !== 'declined')) return NextResponse.json({ ok: true, mailed: false });
    await db.from('lawyer_inquiries').update({ decided_at: new Date().toISOString() }).eq('id', id);
    if (!q.email || !mailConfigured()) return NextResponse.json({ ok: true, mailed: false });
    const { data: me } = await db.from('lawyer_access').select('display_name, register_name, contact_email, phone').eq('user_id', u.user.id).maybeSingle();
    const catalog = `${process.env.STUDUJPRAVO_URL || 'https://studujpravo.cz'}/advokati?${new URLSearchParams({ ...(q.area ? { obor: q.area } : {}), ...(q.region ? { kraj: q.region } : {}) })}`;
    const m = decisionMail(q.status, { clientName: q.name, lawyerName: String(me?.display_name || me?.register_name || 'advokát'), lawyerEmail: String(me?.contact_email ?? ''), lawyerPhone: String(me?.phone ?? ''), catalogUrl: catalog });
    const mailed = await sendMail(q.email, m.subject, m.text).then(() => true, () => false);
    return NextResponse.json({ ok: true, mailed });
}
