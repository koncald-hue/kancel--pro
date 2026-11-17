// Druhý faktor klientského odkazu: jednorázový kód z e-mailu, který zadal advokát, a po ověření relace
// v HttpOnly cookie (skript stránky ji nepřečte). Kódy i relace se v databázi ukládají jen jako otisky.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinkRow } from './serverSupabase';
import { maskEmail } from './mail';
import { sealSecret } from './signServer';

export const CODE_TTL_MS = 10 * 60_000;
export const SESSION_TTL_MS = 12 * 60 * 60_000;
export const CODE_MAX_ATTEMPTS = 5;
export const COOKIE = 'portal_session';

export type FactorLink = LinkRow & { second_factor?: string; code_email?: string };

export const requiresCode = (link: FactorLink) => link.second_factor === 'email' && !!link.code_email;
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const codeHash = (linkId: string, code: string) => createHmac('sha256', `portal-code:${sealSecret()}`).update(`${linkId}:${code}`).digest('hex');
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const newSession = () => randomBytes(32).toString('hex');

export function sameHash(a: string, b: string): boolean {
    if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function readCookie(req: Request, name: string): string {
    const raw = req.headers.get('cookie') ?? '';
    for (const part of raw.split(';')) {
        const i = part.indexOf('=');
        if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
    }
    return '';
}

// Cookie platí jen pro API tohoto odkazu, nejde do jiných odkazů ani do zbytku aplikace
export function sessionCookie(token: string, value: string, maxAgeSec: number): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${COOKIE}=${value}; Path=/api/portal/${encodeURIComponent(token)}; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Strict${secure}`;
}

export async function hasPortalSession(db: SupabaseClient, link: FactorLink, req: Request): Promise<boolean> {
    const value = readCookie(req, COOKIE);
    if (!/^[0-9a-f]{64}$/.test(value)) return false;
    const { data } = await db.from('portal_sessions').select('id').eq('link_id', link.id).eq('session_hash', sha256(value)).gt('session_expires_at', new Date().toISOString()).maybeSingle();
    return !!data;
}

// Vrátí odpověď 401, když odkaz vyžaduje kód a tento prohlížeč ho ještě neověřil; jinak null
export async function secondFactorBlock(db: SupabaseClient, link: FactorLink, req: Request): Promise<NextResponse | null> {
    if (!requiresCode(link)) return null;
    if (await hasPortalSession(db, link, req)) return null;
    return NextResponse.json({ error: 'code-required', email: maskEmail(link.code_email ?? '') }, { status: 401 });
}
