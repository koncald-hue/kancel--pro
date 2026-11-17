import { NextResponse } from 'next/server';
import { loadSignRequest, portalGuard, sealSecret } from '@/lib/signServer';
import { devOtp, sendSms, smsConfigured } from '@/lib/sms';
import { mailConfigured, sendMail } from '@/lib/mail';
import { OTP_MAX_SENDS_PER_HOUR, OTP_TTL_MS, generateOtp, isExpired, normalizePhone, otpHash } from '@/lib/signing';

// Pošle klientovi SMS kód. Číslo určil advokát při zadání žádosti; klient ho zde nemění.
export async function POST(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
    const { token, id } = await ctx.params;
    const g = await portalGuard(req, token, 'sgo', 30, 60 * 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const r = await loadSignRequest(db, link, id);
    if (!r || r.status !== 'pending' || isExpired(r) || r.level !== 'advanced') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    // Kanál: SMS, je-li brána zapnutá a je telefon; jinak e-mail, je-li zapnutý a advokát zadal adresu
    const phone = normalizePhone(r.signer_phone);
    const useSms = !!phone && smsConfigured();
    const useMail = !useSms && mailConfigured() && !!r.signer_email;
    if (!useSms && !useMail && !devOtp()) return NextResponse.json({ error: 'no-channel', message: 'Kód se zatím nedá poslat. Požádejte advokáta, ať vám ho sdělí.' }, { status: 503 });
    if (r.identity_method === 'bankid') {
        const { data: ok } = await db.from('identity_sessions').select('id').eq('purpose', 'signature').eq('ref_id', r.id).not('verified_at', 'is', null).limit(1);
        if (!ok?.length) return NextResponse.json({ error: 'identity', message: 'Nejdřív ověřte totožnost přes Bank iD.' }, { status: 403 });
    }
    const code = generateOtp();
    const channel = useMail ? 'email' : useSms ? 'sms' : 'lawyer';
    const { data: issued, error } = await db.rpc('issue_signature_otp', {
        p_request: r.id, p_code_hash: await otpHash(sealSecret(), r.id, code),
        p_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        p_channel: channel, p_max_sends: OTP_MAX_SENDS_PER_HOUR,
    });
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
    if (issued === 'limit') return NextResponse.json({ error: 'limit', message: 'Kód lze poslat nejvýše třikrát za hodinu.' }, { status: 429 });
    if (issued !== 'ok') return NextResponse.json({ error: 'invalid' }, { status: 400 });
    if (!useSms && !useMail) return NextResponse.json({ sent: true, devCode: code });
    try {
        if (useSms && phone) await sendSms(phone, `Kód pro podpis dokumentu: ${code}. Platí 10 minut. Nikomu ho nesdělujte.`);
        else await sendMail(r.signer_email, 'Kód pro podpis dokumentu', `Váš kód pro podpis dokumentu „${r.title}“: ${code}\n\nKód platí 10 minut. Nikomu ho nesdělujte. Pokud jste o podpis nežádali, e-mail ignorujte.`);
    } catch { return NextResponse.json({ error: 'send', message: 'Kód se nepodařilo odeslat.' }, { status: 502 }); }
    return NextResponse.json({ sent: true, via: useMail ? 'email' : 'sms' });
}
