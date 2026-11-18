import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited, serviceClient } from '@/lib/serverSupabase';
import { mfaBlocked } from '@/lib/serverMfa';
import { mailConfigured, maskEmail, sendMail } from '@/lib/mail';
import { digestFor } from '@/lib/digestServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Náhled a zkušební odeslání vlastního týdenního souhrnu. Posílá se jen na e-mail přihlášeného účtu.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error } = await user.auth.getUser(token);
    if (error || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(u.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const body = await req.json().catch(() => null) as { send?: unknown; details?: unknown } | null;
    const send = body?.send === true; const details = body?.details === true;
    if (await rateLimited(`digest:${u.user.id}`, send ? 3 : 20, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const today = new Date().toISOString().slice(0, 10);
    const d = await digestFor(db, u.user.id, today, details);
    if (!send) return NextResponse.json({ subject: d.mail.subject, text: d.mail.text, worth: d.worth }, { headers: { 'Cache-Control': 'no-store' } });
    if (!mailConfigured()) return NextResponse.json({ error: 'mail_off' }, { status: 503 });
    const to = u.user.email ?? '';
    try { await sendMail(to, d.mail.subject, d.mail.text); } catch { return NextResponse.json({ error: 'mail_failed' }, { status: 502 }); }
    return NextResponse.json({ sent: true, to: maskEmail(to) }, { headers: { 'Cache-Control': 'no-store' } });
}
