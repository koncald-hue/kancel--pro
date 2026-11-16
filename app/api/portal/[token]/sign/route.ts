import { NextResponse } from 'next/server';
import { portalGuard, SIGN_COLS, type SignRow } from '@/lib/signServer';
import { bankIdConfig } from '@/lib/bankid';
import { smsConfigured, devOtp } from '@/lib/sms';
import { maskPhone, isExpired } from '@/lib/signing';
import { mailConfigured, maskEmail } from '@/lib/mail';

// Dokumenty k podpisu pro klienta ve věci odkazu
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    const g = await portalGuard(req, token, 'sg', 120, 60_000);
    if (g instanceof NextResponse) return g;
    const { db, link } = g;
    const { data, error } = await db.from('signature_requests').select(SIGN_COLS).eq('case_id', link.case_id).neq('status', 'cancelled').order('created_at', { ascending: false });
    if (error) return NextResponse.json({ requests: [], enabled: false });
    const rows = (data ?? []) as SignRow[];
    const ids = rows.map((r) => r.id);
    const sessions = ids.length ? (await db.from('identity_sessions').select('ref_id, verified_at, result').eq('purpose', 'signature').in('ref_id', ids).not('verified_at', 'is', null)).data ?? [] : [];
    const verified = new Set(sessions.map((s) => s.ref_id as string));
    const requests = rows.map((r) => ({
        id: r.id, title: r.title, kind: r.kind, level: r.level, status: r.status === 'pending' && isExpired(r) ? 'expired' : r.status, file_id: r.file_id, doc_sha256: r.doc_sha256,
        identity_method: r.identity_method, identity_verified: r.identity_method === 'bankid' ? verified.has(r.id) : r.identity_method === 'lawyer', phone: r.signer_phone ? maskPhone(r.signer_phone) : '', email: r.signer_email ? maskEmail(r.signer_email) : '',
        signed_at: r.signed_at, expires_at: r.expires_at, created_at: r.created_at, decline_reason: r.decline_reason,
    }));
    return NextResponse.json({ requests, enabled: true, bankid: !!bankIdConfig('https://x'), idp: bankIdConfig('https://x')?.label ?? 'Bank iD', sms: smsConfigured() || devOtp(), mail: mailConfigured() });
}
