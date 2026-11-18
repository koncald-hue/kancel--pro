import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited, serviceClient } from '@/lib/serverSupabase';
import { sealSecret } from '@/lib/signServer';
import { generateOtp, isExpired, otpHash, OTP_MAX_SENDS_PER_HOUR } from '@/lib/signing';
import { mfaBlocked } from '@/lib/serverMfa';

const TTL_MS = 30 * 60_000;

// Bez SMS brány: advokát si vygeneruje kód a klientovi ho sdělí sám (telefonicky nebo osobně). Kód se vrací jen jednou, uložen je jen jeho otisk.
export async function POST(req: Request) {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !url || !anon) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null) as { id?: unknown } | null;
    if (typeof body?.id !== 'string') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    // Žádost musí patřit tomuto advokátovi (pravidla přístupu v databázi)
    const user = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await user.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(authData.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    if (await rateLimited(`sign-code:${authData.user.id}`, 20, 60 * 60_000)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const { data: r } = await user.from('signature_requests').select('id, status, level, expires_at').eq('id', body.id).maybeSingle();
    if (!r || r.status !== 'pending' || r.level !== 'advanced' || isExpired(r as { expires_at: string | null })) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const code = generateOtp();
    const { data: issued, error } = await db.rpc('issue_signature_otp', {
        p_request: r.id, p_code_hash: await otpHash(sealSecret(), r.id as string, code),
        p_expires_at: new Date(Date.now() + TTL_MS).toISOString(), p_channel: 'lawyer',
        p_max_sends: OTP_MAX_SENDS_PER_HOUR,
    });
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
    if (issued === 'limit') return NextResponse.json({ error: 'rate', message: 'Pro tuto žádost už byl kód poslán příliš často.' }, { status: 429 });
    if (issued !== 'ok') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    return NextResponse.json({ code, minutes: TTL_MS / 60_000 });
}
