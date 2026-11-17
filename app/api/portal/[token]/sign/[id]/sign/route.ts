import { NextResponse } from 'next/server';
import { loadSignRequest, portalGuard, sealSecret } from '@/lib/signServer';
import type { VerifiedIdentity } from '@/lib/bankid';
import { CONSENT_TEXT, sameName, OTP_MAX_ATTEMPTS, isExpired, isSha256, maskPhone, normalizePhone, otpHash, sealEvidence, type Evidence } from '@/lib/signing';
import { maskEmail } from '@/lib/mail';
import { clientIp } from '@/lib/serverSupabase';

// Podpis: klient potvrdí, že viděl dokument s daným otiskem, zadá SMS kód a po ověření totožnosti vznikne zapečetěný doklad o podpisu
export async function POST(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
    const { token, id } = await ctx.params;
    const g = await portalGuard(req, token, 'sgs', 30, 60 * 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const r = await loadSignRequest(db, link, id);
    if (!r || r.status !== 'pending' || isExpired(r) || r.level !== 'advanced') return NextResponse.json({ error: 'invalid', message: 'Dokument už nelze podepsat.' }, { status: 400 });
    const body = await req.json().catch(() => null) as { code?: unknown; docSha256?: unknown; agree?: unknown; typedName?: unknown } | null;
    if (body?.agree !== true) return NextResponse.json({ error: 'agree', message: 'Potvrďte, že souhlasíte s dokumentem.' }, { status: 400 });
    // Dokument, který klient viděl, musí být přesně ten, který advokát vložil
    if (!isSha256(body.docSha256) || body.docSha256 !== r.doc_sha256) return NextResponse.json({ error: 'hash', message: 'Dokument se od zadání změnil nebo ho nelze ověřit. Obnovte stránku nebo napište advokátovi.' }, { status: 409 });

    // Jméno podepisujícího určil advokát. Klient ho musí vlastnoručně přepsat, aby podepsal vědomě pod tímto jménem.
    const typedName = typeof body.typedName === 'string' ? body.typedName.trim().slice(0, 160) : '';
    if (!r.signer_name) return NextResponse.json({ error: 'name', message: 'U žádosti chybí jméno podepisujícího. Napište advokátovi.' }, { status: 400 });
    if (!sameName(typedName, r.signer_name)) return NextResponse.json({ error: 'name', message: 'Napište své jméno přesně tak, jak je uvedeno u dokumentu.' }, { status: 400 });
    // Totožnost
    let identity: Evidence['identity'] = { method: r.identity_method, note: r.identity_note || undefined };
    if (r.identity_method === 'bankid') {
        const { data: ses } = await db.from('identity_sessions').select('result, verified_at').eq('purpose', 'signature').eq('ref_id', r.id).not('verified_at', 'is', null).order('verified_at', { ascending: false }).limit(1);
        const v = ses?.[0]?.result as (VerifiedIdentity & { provider?: string }) | undefined;
        if (!v) return NextResponse.json({ error: 'identity', message: 'Nejdřív ověřte totožnost přes Bank iD.' }, { status: 403 });
        if (!sameName(`${v.given} ${v.family}`, r.signer_name)) return NextResponse.json({ error: 'name', message: 'Ověřená totožnost neodpovídá osobě, které byl dokument určen.' }, { status: 403 });
        const idPhone = v.phone ? normalizePhone(v.phone) : null; const reqPhone = normalizePhone(r.signer_phone);
        identity = { method: 'bankid', provider: v.provider, given: v.given, family: v.family, birthdate: v.birthdate, sub: v.sub, verifiedAt: ses?.[0]?.verified_at as string, phoneMatch: idPhone && reqPhone ? idPhone === reqPhone : undefined };
    }

    // SMS kód
    const { data: otps } = await db.from('signature_otps').select('id, expires_at, channel').eq('request_id', r.id).eq('used', false).order('created_at', { ascending: false }).limit(1);
    const otp = otps?.[0];
    if (!otp) return NextResponse.json({ error: 'otp', message: 'Kód vypršel nebo nebyl poslán. Pošlete si nový.' }, { status: 400 });
    const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '').slice(0, 32) : '';
    const { data: otpResult, error: otpError } = await db.rpc('consume_signature_otp', {
        p_request: r.id, p_otp: otp.id, p_code_hash: await otpHash(sealSecret(), r.id, code),
        p_max_attempts: OTP_MAX_ATTEMPTS,
    });
    if (otpError) return NextResponse.json({ error: 'failed' }, { status: 500 });
    if (otpResult === 'limit') return NextResponse.json({ error: 'otp', message: 'Příliš mnoho pokusů. Pošlete si nový kód.' }, { status: 429 });
    if (otpResult === 'mismatch') return NextResponse.json({ error: 'otp', message: 'Kód nesouhlasí.' }, { status: 400 });
    if (otpResult !== 'ok') return NextResponse.json({ error: 'otp', message: 'Kód vypršel nebo už byl použit.' }, { status: 409 });

    const now = new Date().toISOString();
    const evidence: Evidence = {
        v: 1, requestId: r.id, title: r.title, level: 'advanced', docSha256: r.doc_sha256,
        signer: { name: identity.given ? `${identity.given} ${identity.family}` : r.signer_name, typedName, phoneMasked: maskPhone(r.signer_phone), emailMasked: r.signer_email ? maskEmail(r.signer_email) : undefined },
        identity, otp: { channel: otp.channel === 'lawyer' ? 'lawyer' : otp.channel === 'email' ? 'email' : 'sms', verifiedAt: now }, signedAt: now, ip: clientIp(req), userAgent: (req.headers.get('user-agent') ?? '').slice(0, 300), consent: CONSENT_TEXT,
    };
    const seal = await sealEvidence(sealSecret(), evidence);
    const { data: done, error } = await db.from('signature_requests').update({ status: 'signed', signed_at: now, evidence, evidence_seal: seal }).eq('id', r.id).eq('status', 'pending').select('id');
    if (error || !done?.length) return NextResponse.json({ error: 'failed', message: 'Podpis se nepodařilo uložit.' }, { status: 500 });
    return NextResponse.json({ signed: true, signedAt: now });
}
