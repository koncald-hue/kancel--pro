import { NextResponse } from 'next/server';
import { loadSignRequest, portalGuard, sealSecret } from '@/lib/signServer';
import { devOtp, sendSms, smsConfigured } from '@/lib/sms';
import { OTP_MAX_SENDS_PER_HOUR, OTP_TTL_MS, generateOtp, isExpired, normalizePhone, otpHash } from '@/lib/signing';

// Pošle klientovi SMS kód. Číslo určil advokát při zadání žádosti; klient ho zde nemění.
export async function POST(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
    const { token, id } = await ctx.params;
    const g = await portalGuard(req, token, 'sgo', 30, 60 * 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const r = await loadSignRequest(db, link, id);
    if (!r || r.status !== 'pending' || isExpired(r) || r.level !== 'advanced') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const phone = normalizePhone(r.signer_phone);
    if (!phone) return NextResponse.json({ error: 'no-phone', message: 'U žádosti chybí platné telefonní číslo. Napište advokátovi.' }, { status: 400 });
    if (!smsConfigured() && !devOtp()) return NextResponse.json({ error: 'sms-off', message: 'Odesílání SMS zatím není zapnuté.' }, { status: 503 });
    if (r.identity_method === 'bankid') {
        const { data: ok } = await db.from('identity_sessions').select('id').eq('purpose', 'signature').eq('ref_id', r.id).not('verified_at', 'is', null).limit(1);
        if (!ok?.length) return NextResponse.json({ error: 'identity', message: 'Nejdřív ověřte totožnost přes Bank iD.' }, { status: 403 });
    }
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from('signature_otps').select('id', { count: 'exact', head: true }).eq('request_id', r.id).gte('created_at', since);
    if ((count ?? 0) >= OTP_MAX_SENDS_PER_HOUR) return NextResponse.json({ error: 'limit', message: 'Kód lze poslat nejvýše třikrát za hodinu.' }, { status: 429 });
    const code = generateOtp();
    const { error } = await db.from('signature_otps').insert({ request_id: r.id, code_hash: await otpHash(sealSecret(), r.id, code), expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString() });
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
    if (devOtp() && !smsConfigured()) return NextResponse.json({ sent: true, devCode: code });
    try { await sendSms(phone, `Kód pro podpis dokumentu: ${code}. Platí 10 minut. Nikomu ho nesdělujte.`); }
    catch { return NextResponse.json({ error: 'sms', message: 'SMS se nepodařilo odeslat.' }, { status: 502 }); }
    return NextResponse.json({ sent: true });
}
