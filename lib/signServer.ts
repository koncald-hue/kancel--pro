import type { SupabaseClient } from '@supabase/supabase-js';
import { getSiteOrigin } from './siteUrl';
import type { LinkRow } from './serverSupabase';
import type { SignStatus } from './signing';

// Tajný klíč pečeti a SMS kódů: SIGN_SEAL_SECRET, jinak odvozený od serverového klíče databáze
export function sealSecret(): string {
    return process.env.SIGN_SEAL_SECRET || `seal:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`;
}

export type SignRow = { id: string; user_id: string; case_id: string; file_id: string | null; title: string; kind: string; level: 'advanced' | 'qualified'; identity_method: 'bankid' | 'lawyer' | 'none'; identity_note: string; doc_sha256: string; signer_name: string; signer_phone: string; signer_email: string; status: SignStatus; expires_at: string | null; signed_at: string | null; created_at: string; decline_reason: string; package_id?: string | null };
export const SIGN_COLS = 'id, user_id, case_id, file_id, title, kind, level, identity_method, identity_note, doc_sha256, signer_name, signer_phone, signer_email, status, expires_at, signed_at, created_at, decline_reason';
// Sloupec package_id vzniká až spuštěním podpisy-balicky.sql; do té doby se čte bez něj
export const SIGN_COLS_PKG = `${SIGN_COLS}, package_id`;

// Žádost o podpis patří ke věci klientského odkazu
export async function loadSignRequest(db: SupabaseClient, link: LinkRow, id: string): Promise<SignRow | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const { data } = await db.from('signature_requests').select(SIGN_COLS).eq('id', id).eq('case_id', link.case_id).maybeSingle();
    return (data as SignRow | null) ?? null;
}

export function originOf(req: Request): string {
    const configured = getSiteOrigin();
    if (configured) return configured;
    if (process.env.NODE_ENV === 'production') throw new Error('NEXT_PUBLIC_SITE_URL musí být v produkci nastavena na HTTPS adresu aplikace.');
    return new URL(req.url).origin;
}

import { NextResponse } from 'next/server';
import { clientIp, findActiveLink, rateLimited, serviceClient } from './serverSupabase';
import { secondFactorBlock, type FactorLink } from './portalSession';

// Společná kontrola tras klientského odkazu: limit, databáze, platný odkaz, ověřený a zaplacený advokát, klient vyplnil údaje
export async function portalGuard(req: Request, token: string, bucket: string, limit: number, windowMs: number): Promise<{ db: SupabaseClient; link: LinkRow & { client_name?: string; client_phone?: string; onboarded_at?: string | null } } | NextResponse> {
    if (await rateLimited(`${bucket}:${clientIp(req)}`, limit, windowMs)) return NextResponse.json({ error: 'rate' }, { status: 429 });
    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    const link = await findActiveLink(db, token);
    if (!link) return NextResponse.json({ error: 'notfound' }, { status: 404 });
    if (!link.verified) return NextResponse.json({ error: 'unverified' }, { status: 403 });
    if (!link.subscribed) return NextResponse.json({ error: 'inactive' }, { status: 403 });
    // Druhý faktor (kód z e-mailu), pokud ho advokát u odkazu zapnul
    const block = await secondFactorBlock(db, link as FactorLink, req);
    if (block) return block;
    if (!(link as { onboarded_at?: string | null }).onboarded_at) return NextResponse.json({ error: 'not-onboarded' }, { status: 403 });
    return { db, link: link as never };
}
