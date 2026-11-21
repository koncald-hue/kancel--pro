import { NextResponse } from 'next/server';
import { portalGuard, SIGN_COLS_PKG, sealSecret, type SignRow } from '@/lib/signServer';
import type { VerifiedIdentity } from '@/lib/bankid';
import { CONSENT_TEXT, OTP_MAX_ATTEMPTS, isExpired, isSha256, leadOf, maskPhone, normalizePhone, otpHash, packageProblem, sameName, sealEvidence, type Evidence } from '@/lib/signing';
import { maskEmail } from '@/lib/mail';
import { clientIp } from '@/lib/serverSupabase';

// Podpis celého balíčku jedním kódem. Kód a ověření totožnosti patří prvnímu dokumentu balíčku; každý dokument dostane vlastní zapečetěný doklad.
export async function POST(req: Request, ctx: { params: Promise<{ token: string; pkg: string }> }) {
    const { token, pkg } = await ctx.params;
    const g = await portalGuard(req, token, 'sgp', 30, 60 * 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    if (!/^[0-9a-f-]{36}$/.test(pkg)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    const { data } = await db.from('signature_requests').select(SIGN_COLS_PKG).eq('case_id', link.case_id).eq('package_id', pkg).eq('status', 'pending');
    const rows = ((data ?? []) as unknown as SignRow[]).filter((r) => !isExpired(r));
    const problem = packageProblem(rows);
    if (problem) return NextResponse.json({ error: 'invalid', message: problem }, { status: 400 });
    const lead = leadOf(rows);
    const body = await req.json().catch(() => null) as { code?: unknown; agree?: unknown; typedName?: unknown; hashes?: unknown } | null;
    if (body?.agree !== true) return NextResponse.json({ error: 'agree', message: 'Potvrďte, že souhlasíte se všemi dokumenty.' }, { status: 400 });
    const hashes = (body.hashes && typeof body.hashes === 'object' ? body.hashes : {}) as Record<string, unknown>;
    for (const r of rows) if (!isSha256(hashes[r.id]) || hashes[r.id] !== r.doc_sha256) return NextResponse.json({ error: 'hash', message: 'Některý dokument se od zadání změnil nebo ho nelze ověřit. Obnovte stránku nebo napište advokátovi.' }, { status: 409 });
    const typedName = typeof body.typedName === 'string' ? body.typedName.trim().slice(0, 160) : '';
    if (!lead.signer_name) return NextResponse.json({ error: 'name', message: 'U žádosti chybí jméno podepisujícího. Napište advokátovi.' }, { status: 400 });
    if (!sameName(typedName, lead.signer_name)) return NextResponse.json({ error: 'name', message: 'Napište své jméno přesně tak, jak je uvedeno u dokumentů.' }, { status: 400 });

    let identity: Evidence['identity'] = { method: lead.identity_method, note: lead.identity_note || undefined };
    if (lead.identity_method === 'bankid') {
        const { data: ses } = await db.from('identity_sessions').select('result, verified_at').eq('purpose', 'signature').eq('ref_id', lead.id).not('verified_at', 'is', null).order('verified_at', { ascending: false }).limit(1);
        const v = ses?.[0]?.result as (VerifiedIdentity & { provider?: string }) | undefined;
        if (!v) return NextResponse.json({ error: 'identity', message: 'Nejdřív ověřte totožnost přes Bank iD.' }, { status: 403 });
        if (!sameName(`${v.given} ${v.family}`, lead.signer_name)) return NextResponse.json({ error: 'name', message: 'Ověřená totožnost neodpovídá osobě, které byly dokumenty určeny.' }, { status: 403 });
        const idPhone = v.phone ? normalizePhone(v.phone) : null; const reqPhone = normalizePhone(lead.signer_phone);
        identity = { method: 'bankid', provider: v.provider, given: v.given, family: v.family, birthdate: v.birthdate, sub: v.sub, verifiedAt: ses?.[0]?.verified_at as string, phoneMatch: idPhone && reqPhone ? idPhone === reqPhone : undefined };
    }

    const { data: otps } = await db.from('signature_otps').select('id, channel').eq('request_id', lead.id).eq('used', false).order('created_at', { ascending: false }).limit(1);
    const otp = otps?.[0];
    if (!otp) return NextResponse.json({ error: 'otp', message: 'Kód vypršel nebo nebyl poslán. Pošlete si nový.' }, { status: 400 });
    const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '').slice(0, 32) : '';
    const { data: otpResult, error: otpError } = await db.rpc('consume_signature_otp', { p_request: lead.id, p_otp: otp.id, p_code_hash: await otpHash(sealSecret(), lead.id, code), p_max_attempts: OTP_MAX_ATTEMPTS });
    if (otpError) return NextResponse.json({ error: 'failed' }, { status: 500 });
    if (otpResult === 'limit') return NextResponse.json({ error: 'otp', message: 'Příliš mnoho pokusů. Pošlete si nový kód.' }, { status: 429 });
    if (otpResult === 'mismatch') return NextResponse.json({ error: 'otp', message: 'Kód nesouhlasí.' }, { status: 400 });
    if (otpResult !== 'ok') return NextResponse.json({ error: 'otp', message: 'Kód vypršel nebo už byl použit.' }, { status: 409 });

    const now = new Date().toISOString();
    const documents = rows.map((r) => ({ requestId: r.id, title: r.title, docSha256: r.doc_sha256 }));
    const ip = clientIp(req); const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 300);
    let signed = 0;
    for (const r of rows) {
        const evidence: Evidence = {
            v: 1, requestId: r.id, title: r.title, level: 'advanced', docSha256: r.doc_sha256,
            signer: { name: identity.given ? `${identity.given} ${identity.family}` : r.signer_name, typedName, phoneMasked: maskPhone(r.signer_phone), emailMasked: r.signer_email ? maskEmail(r.signer_email) : undefined },
            identity, otp: { channel: otp.channel === 'lawyer' ? 'lawyer' : otp.channel === 'email' ? 'email' : 'sms', verifiedAt: now }, signedAt: now, ip, userAgent, consent: CONSENT_TEXT,
            package: { id: pkg, documents },
        };
        const seal = await sealEvidence(sealSecret(), evidence);
        const { data: done } = await db.from('signature_requests').update({ status: 'signed', signed_at: now, evidence, evidence_seal: seal }).eq('id', r.id).eq('status', 'pending').select('id');
        if (done?.length) signed += 1;
    }
    if (signed !== rows.length) return NextResponse.json({ error: 'failed', message: `Podepsalo se ${signed} z ${rows.length} dokumentů. Obnovte stránku a zkontrolujte stav.` }, { status: 500 });
    return NextResponse.json({ signed: true, signedAt: now, count: signed });
}
