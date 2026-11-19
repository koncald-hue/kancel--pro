import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimited } from '@/lib/serverSupabase';
import { MS_AUTHORITY, MS_CALLBACK_PATH, MS_EVENT_KEYS, MS_GRAPH, MS_ID, MS_SCOPE } from '@/lib/msCal';
import { mfaBlocked } from '@/lib/serverMfa';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const NO_STORE = { 'Cache-Control': 'no-store' };
const tenant = () => (/^[A-Za-z0-9.-]{3,100}$/.test(process.env.MICROSOFT_TENANT ?? '') ? process.env.MICROSOFT_TENANT! : 'common');

async function tokenRequest(params: Record<string, string>) {
    const id = process.env.MICROSOFT_CLIENT_ID; const secret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!id || !secret) return { ok: false as const, status: 503, message: 'Kalendář Microsoft 365 není na serveru nastavený.' };
    const res = await fetch(`${MS_AUTHORITY}/${tenant()}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: id, client_secret: secret, scope: MS_SCOPE, ...params }), cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    const j = await res.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
    if (!res.ok || !j.access_token) return { ok: false as const, status: res.status === 400 || res.status === 401 ? 401 : 502, message: (j.error_description || j.error || 'Přihlášení k Microsoftu se nezdařilo.').split('\r\n')[0].slice(0, 300) };
    return { ok: true as const, tokens: { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in ?? 3600) * 1000 } };
}

// Most k Microsoft Graph. Přístupové tokeny přicházejí s požadavkem (jsou uložené zašifrované v prohlížeči) a na serveru se neukládají.
// Povolené jsou jen operace nad kalendářem vytvořeným aplikací (zadaným podle ID) a jen na adrese graph.microsoft.com.
export async function POST(req: Request) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (body?.action === 'config') return NextResponse.json({ configured: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET), clientId: process.env.MICROSOFT_CLIENT_ID ?? '', tenant: tenant() }, { headers: NO_STORE });

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: u, error: ue } = await user.auth.getUser(token);
    if (ue || !u.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (mfaBlocked(u.user, token)) return NextResponse.json({ error: 'mfa' }, { status: 401 });
    if (await rateLimited(`microsoft:${u.user.id}`, 240, 60_000)) return NextResponse.json({ error: 'rate', message: 'Příliš mnoho požadavků, zkuste to za chvíli.' }, { status: 429 });
    const { data: allowed } = await user.rpc('has_lawyer_access');
    if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

    try {
        if (body.action === 'exchange') {
            const redirectUri = clean(body.redirectUri, 300);
            if (redirectUri !== `${new URL(req.url).origin}${MS_CALLBACK_PATH}`) return NextResponse.json({ error: 'bad_request', message: 'Neplatná adresa pro přesměrování.' }, { status: 400 });
            const r = await tokenRequest({ grant_type: 'authorization_code', code: clean(body.code, 4000), code_verifier: clean(body.verifier, 200), redirect_uri: redirectUri });
            return r.ok ? NextResponse.json({ tokens: r.tokens }, { headers: NO_STORE }) : NextResponse.json({ error: 'microsoft', message: r.message }, { status: r.status, headers: NO_STORE });
        }
        if (body.action === 'refresh') {
            const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: clean(body.refreshToken, 6000) });
            return r.ok ? NextResponse.json({ tokens: r.tokens }, { headers: NO_STORE }) : NextResponse.json({ error: 'microsoft', message: r.message }, { status: r.status, headers: NO_STORE });
        }
        if (body.action === 'cal') {
            const access = clean(body.accessToken, 6000);
            const op = clean(body.op, 20);
            const calendarId = clean(body.calendarId, 400); const eventId = clean(body.eventId, 400);
            if (!access) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            let url = ''; let method = 'POST'; let payload: Record<string, unknown> | null = null;
            if (op === 'createCalendar') { url = `${MS_GRAPH}/me/calendars`; payload = { name: clean((body.body as Record<string, unknown> | undefined)?.name, 100) || 'Kancelář – lhůty' }; }
            else if (!MS_ID.test(calendarId)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            else if (op === 'deleteCalendar') { url = `${MS_GRAPH}/me/calendars/${encodeURIComponent(calendarId)}`; method = 'DELETE'; }
            else if (op === 'insert') { url = `${MS_GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events`; }
            else if ((op === 'patch' || op === 'delete') && MS_ID.test(eventId)) { url = `${MS_GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`; method = op === 'patch' ? 'PATCH' : 'DELETE'; }
            else return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            if (op === 'insert' || op === 'patch') {
                const src = (body.body && typeof body.body === 'object' ? body.body : {}) as Record<string, unknown>;
                payload = Object.fromEntries(Object.entries(src).filter(([k]) => MS_EVENT_KEYS.includes(k)));
                if (JSON.stringify(payload).length > 12_000) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
            }
            const res = await fetch(url, { method, headers: { Authorization: `Bearer ${access}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
            if (method === 'DELETE') return NextResponse.json({ status: res.status }, { headers: NO_STORE });
            const j = await res.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
            if (!res.ok) return NextResponse.json({ status: res.status, message: (j.error?.message ?? 'Microsoft odmítl požadavek.').slice(0, 300) }, { status: res.status === 401 ? 401 : 200, headers: NO_STORE });
            return NextResponse.json({ status: res.status === 201 ? 200 : res.status, id: j.id }, { headers: NO_STORE });
        }
    } catch { return NextResponse.json({ error: 'upstream', message: 'Microsoft teď neodpovídá.' }, { status: 502, headers: NO_STORE }); }
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}
