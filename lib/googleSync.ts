import { supabase } from './supabase';
import { decryptText, encryptText, getMaster, toB64u } from './e2ee';
import { loadAllDeadlines } from './caseFile';
import { loadCases } from './cases';
import { pragueDate } from './lhuty';
import { CALENDAR_NAME, GOOGLE_CALLBACK_PATH, desiredEvents, eventBody, googleAuthorizeUrl, hashOf, planSync, type Desired, type Detail, type GoogleTokens, type Mapped } from './googleCal';

// Prohlížečová část propojení s Google Kalendářem: přihlášení (PKCE), zašifrované uložení tokenů a synchronizace lhůt.
export type ApiRes = { ok: boolean; status: number; json: Record<string, unknown> };
async function api(body: Record<string, unknown>): Promise<ApiRes> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/google', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) as Record<string, unknown> };
}
export const googleConfig = async () => { const r = await api({ action: 'config' }); return { configured: r.json.configured === true, clientId: String(r.json.clientId ?? '') }; };

const PENDING = 'google-pending';
type Pending = { verifier: string; state: string; returnTo: string };
const rand = (n = 32) => toB64u(crypto.getRandomValues(new Uint8Array(n)));
const challengeOf = async (v: string) => toB64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));

export async function startGoogleConnect(returnTo: string): Promise<string> {
    const cfg = await googleConfig();
    if (!cfg.configured) throw new Error('Google Kalendář zatím není na serveru nastavený (chybí GOOGLE_CLIENT_ID a GOOGLE_CLIENT_SECRET).');
    const verifier = rand(48); const state = rand(16);
    sessionStorage.setItem(PENDING, JSON.stringify({ verifier, state, returnTo } satisfies Pending));
    return googleAuthorizeUrl({ clientId: cfg.clientId, redirectUri: `${window.location.origin}${GOOGLE_CALLBACK_PATH}`, challenge: await challengeOf(verifier), state });
}
export const readGooglePending = (): Pending | null => { try { return JSON.parse(sessionStorage.getItem(PENDING) ?? 'null') as Pending | null; } catch { return null; } };
export const clearGooglePending = () => { try { sessionStorage.removeItem(PENDING); } catch { /* nic */ } };

export type Row = { calendar_id: string; detail: Detail; internal: boolean; last_sync_at: string | null };
export type Loaded = { row: Row; tokens: GoogleTokens };

export async function finishGoogleConnect(master: CryptoKey, userId: string, code: string, p: Pending): Promise<void> {
    const ex = await api({ action: 'exchange', code, verifier: p.verifier, redirectUri: `${window.location.origin}${GOOGLE_CALLBACK_PATH}` });
    if (!ex.ok) throw new Error(typeof ex.json.message === 'string' ? ex.json.message : 'Přihlášení ke Googlu se nezdařilo.');
    const tokens = ex.json.tokens as GoogleTokens;
    if (!tokens.refresh_token) throw new Error('Google nevrátil trvalé přihlášení. Odeberte aplikaci v nastavení účtu Google a připojte se znovu.');
    const cal = await api({ action: 'cal', accessToken: tokens.access_token, op: 'createCalendar', body: { summary: CALENDAR_NAME } });
    if (!cal.ok || cal.json.status !== 200 || typeof cal.json.id !== 'string') throw new Error(typeof cal.json.message === 'string' ? cal.json.message : 'Kalendář se nepodařilo vytvořit.');
    const enc = await encryptText(master, JSON.stringify(tokens));
    const { error } = await supabase.from('google_connections').upsert({ user_id: userId, calendar_id: cal.json.id, enc_token: enc, detail: 'minimal', internal: true, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
}

export async function loadGoogleConnection(master: CryptoKey): Promise<Loaded | null | 'broken'> {
    const { data, error } = await supabase.from('google_connections').select('calendar_id, detail, internal, last_sync_at, enc_token').maybeSingle();
    if (error) throw new Error(error.message);
    try { if (data) localStorage.setItem('kancelar-google', '1'); else localStorage.removeItem('kancelar-google'); } catch { /* úložiště nemusí být dostupné */ }
    if (!data) return null;
    try { return { row: { calendar_id: data.calendar_id as string, detail: data.detail as Detail, internal: !!data.internal, last_sync_at: (data.last_sync_at as string | null) ?? null }, tokens: JSON.parse(await decryptText(master, String(data.enc_token))) as GoogleTokens }; } catch { return 'broken'; }
}

export async function saveGoogleOptions(detail: Detail, internal: boolean) {
    const { error } = await supabase.from('google_connections').update({ detail, internal, updated_at: new Date().toISOString() }).neq('user_id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(error.message);
}

async function freshToken(master: CryptoKey, c: Loaded, force = false): Promise<GoogleTokens> {
    if (!force && c.tokens.expires_at - Date.now() > 60_000) return c.tokens;
    if (!c.tokens.refresh_token) throw new Error('Přihlášení ke Googlu vypršelo. Připojte se znovu.');
    const r = await api({ action: 'refresh', refreshToken: c.tokens.refresh_token });
    if (!r.ok) throw new Error('Přihlášení ke Googlu vypršelo nebo bylo zrušeno. Připojte se znovu.');
    const t = { ...(r.json.tokens as GoogleTokens), refresh_token: (r.json.tokens as GoogleTokens).refresh_token ?? c.tokens.refresh_token };
    const enc = await encryptText(master, JSON.stringify(t));
    await supabase.from('google_connections').update({ enc_token: enc, updated_at: new Date().toISOString() }).neq('user_id', '00000000-0000-0000-0000-000000000000');
    c.tokens = t;
    return t;
}

export type SyncResult = { inserted: number; patched: number; removed: number; same: number; failed: number; message: string };

let running: Promise<SyncResult> | null = null;
// Jedna synchronizace najednou; volání během běžící synchronizace počká na její výsledek
export function syncGoogle(master: CryptoKey, userId: string): Promise<SyncResult> {
    running ??= doSync(master, userId).finally(() => { running = null; });
    return running;
}

async function doSync(master: CryptoKey, userId: string): Promise<SyncResult> {
    const loaded = await loadGoogleConnection(master);
    if (!loaded || loaded === 'broken') throw new Error(loaded === 'broken' ? 'Přihlášení ke Googlu nejde dešifrovat. Připojte se znovu.' : 'Google Kalendář není připojený.');
    const [cases, customs, mappedRes] = await Promise.all([loadCases(), loadAllDeadlines(), supabase.from('google_calendar_sync').select('key, kind, event_id, hash')]);
    const mapped = (mappedRes.data ?? []) as Mapped[];
    const desired = desiredEvents(cases, customs, { detail: loaded.row.detail, internal: loaded.row.internal }, pragueDate(new Date().toISOString()), window.location.origin);
    const plan = planSync(desired, mapped);
    const calendarId = loaded.row.calendar_id;
    const res: SyncResult = { inserted: 0, patched: 0, removed: 0, same: plan.same, failed: 0, message: '' };
    let token = await freshToken(master, loaded);

    // Volání Googlu s jedním opakováním po vypršení přístupového tokenu
    const call = async (op: string, extra: Record<string, unknown>) => {
        let r = await api({ action: 'cal', accessToken: token.access_token, op, calendarId, ...extra });
        if (r.status === 401) { token = await freshToken(master, loaded, true); r = await api({ action: 'cal', accessToken: token.access_token, op, calendarId, ...extra }); }
        return r;
    };
    const save = (d: Desired, eventId: string) => supabase.from('google_calendar_sync').upsert({ user_id: userId, key: d.key, kind: d.kind, event_id: eventId, hash: hashOf(d) });

    const insert = async (d: Desired) => {
        const r = await call('insert', { body: eventBody(d, d.key) });
        if (r.ok && r.json.status === 200 && typeof r.json.id === 'string') { await save(d, r.json.id); res.inserted += 1; } else res.failed += 1;
    };
    for (const d of plan.insert.slice(0, 300)) await insert(d);
    for (const { d, m } of plan.patch.slice(0, 300)) {
        const r = await call('patch', { eventId: m.event_id, body: eventBody(d, d.key) });
        if (r.ok && r.json.status === 200) { await save(d, m.event_id); res.patched += 1; }
        else if (r.json.status === 404 || r.json.status === 410) await insert(d);
        else res.failed += 1;
    }
    for (const m of plan.remove.slice(0, 300)) {
        const r = await call('delete', { eventId: m.event_id });
        if (r.ok && [200, 204, 404, 410].includes(Number(r.json.status))) { await supabase.from('google_calendar_sync').delete().eq('key', m.key).eq('kind', m.kind); res.removed += 1; } else res.failed += 1;
    }
    await supabase.from('google_connections').update({ last_sync_at: new Date().toISOString() }).neq('user_id', '00000000-0000-0000-0000-000000000000');
    res.message = `Přidáno ${res.inserted}, upraveno ${res.patched}, odebráno ${res.removed}, beze změny ${res.same}${res.failed ? `, selhalo ${res.failed}` : ''}.`;
    window.dispatchEvent(new CustomEvent('google-sync', { detail: res }));
    return res;
}
export async function disconnectGoogle(master: CryptoKey, deleteCalendar: boolean): Promise<void> {
    const loaded = await loadGoogleConnection(master);
    if (deleteCalendar && loaded && loaded !== 'broken') {
        try { const t = await freshToken(master, loaded); await api({ action: 'cal', accessToken: t.access_token, op: 'deleteCalendar', calendarId: loaded.row.calendar_id }); } catch { /* kalendář jde smazat i ručně v Googlu */ }
    }
    await supabase.from('google_calendar_sync').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('google_connections').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
}

// Odložená synchronizace po změně lhůt (tichá, když Google není připojený nebo je šifrovací heslo zamčené)
let timer: ReturnType<typeof setTimeout> | null = null;
export function scheduleGoogleSync() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
        const master = getMaster();
        let connected = false;
        try { connected = localStorage.getItem('kancelar-google') === '1'; } catch { /* nic */ }
        if (!master || !connected) return;
        try { const { data: { user } } = await supabase.auth.getUser(); if (user) await syncGoogle(master, user.id); } catch { /* neúspěšná tichá synchronizace se ukáže v Nastavení při dalším ručním pokusu */ }
    }, 2500);
}
