import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinkRow } from './serverSupabase';
import type { SignStatus } from './signing';

// Tajný klíč pečeti a SMS kódů: SIGN_SEAL_SECRET, jinak odvozený od serverového klíče databáze
export function sealSecret(): string {
    return process.env.SIGN_SEAL_SECRET || `seal:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`;
}

export type SignRow = { id: string; user_id: string; case_id: string; file_id: string | null; title: string; kind: string; level: 'advanced' | 'qualified'; identity_method: 'bankid' | 'lawyer' | 'none'; identity_note: string; doc_sha256: string; signer_name: string; signer_phone: string; signer_email: string; status: SignStatus; expires_at: string | null; signed_at: string | null; created_at: string; decline_reason: string };
export const SIGN_COLS = 'id, user_id, case_id, file_id, title, kind, level, identity_method, identity_note, doc_sha256, signer_name, signer_phone, signer_email, status, expires_at, signed_at, created_at, decline_reason';

// Žádost o podpis patří ke věci klientského odkazu
export async function loadSignRequest(db: SupabaseClient, link: LinkRow, id: string): Promise<SignRow | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const { data } = await db.from('signature_requests').select(SIGN_COLS).eq('id', id).eq('case_id', link.case_id).maybeSingle();
    return (data as SignRow | null) ?? null;
}

export function originOf(req: Request): string {
    const env = process.env.NEXT_PUBLIC_SITE_URL;
    if (env) return env.replace(/\/+$/, '');
    const u = new URL(req.url); return `${u.protocol}//${u.host}`;
}

import { NextResponse } from 'next/server';
import { clientIp, findActiveLink, rateLimited, serviceClient } from './serverSupabase';

// Společná kontrola tras klientského odkazu: limit, databáze, platný odkaz, ověřený a zaplacený advokát, klient vyplnil údaje
export async function portalGuard(req: Request, token: string, bucket: string, limit: number, windowMs: number): Promise<{ db: SupabaseClient; link: LinkRow & { client_name?: string; client_phone?: string; onboarded_at?: string | null } } | NextResponse> {
    if (rateLimited(`${bucket}:${clientIp(req)}`, limit, windowMs)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const link = await findActiveLink(db, token);
    if (!link) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    if (!link.verified) return NextResponse.json({ error: 'unverified' }, { status: 403 });
    if (!link.subscribed) return NextResponse.json({ error: 'inactive' }, { status: 403 });
    if (!(link as { onboarded_at?: string | null }).onboarded_at) return NextResponse.json({ error: 'not-onboarded' }, { status: 403 });
    return { db, link: link as never };
}
