import { supabase } from './supabase';
import { decryptText, encryptText, toB64u } from './e2ee';
import { CALLBACK_PATH, authorizeUrl, type OAuthTokens } from './mcpClient';

// Prohlížečová část přihlášení k DirectCase a volání serverového mostu. Tokeny se ukládají jen zašifrované šifrovacím heslem advokáta.
export type Connection = { clientId: string; tokens: OAuthTokens };
export type ApiRes = { ok: boolean; status: number; json: Record<string, unknown> };

export async function legalApi(body: Record<string, unknown>): Promise<ApiRes> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/legal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) as Record<string, unknown> };
}

const PENDING = 'directcase-pending';
type Pending = { clientId: string; verifier: string; state: string; returnTo: string };

const rand = (bytes = 32) => toB64u(crypto.getRandomValues(new Uint8Array(bytes)));
async function challengeOf(verifier: string) { return toB64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))); }

// Zahájí přihlášení: zaregistruje aplikaci u DirectCase, uloží PKCE údaje a přesměruje uživatele na přihlášení
export async function startConnect(returnTo: string): Promise<string> {
    const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
    const reg = await legalApi({ action: 'register', redirectUri });
    if (!reg.ok) throw new Error(typeof reg.json.message === 'string' ? reg.json.message : 'Registrace u DirectCase se nezdařila.');
    const verifier = rand(48); const state = rand(16);
    const pending: Pending = { clientId: String(reg.json.clientId), verifier, state, returnTo };
    sessionStorage.setItem(PENDING, JSON.stringify(pending));
    return authorizeUrl({ clientId: pending.clientId, redirectUri, challenge: await challengeOf(verifier), state });
}
export const readPending = (): Pending | null => { try { return JSON.parse(sessionStorage.getItem(PENDING) ?? 'null') as Pending | null; } catch { return null; } };
export const clearPending = () => { try { sessionStorage.removeItem(PENDING); } catch { /* nic */ } };

export async function finishConnect(master: CryptoKey, userId: string, code: string, pending: Pending): Promise<void> {
    const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
    const r = await legalApi({ action: 'exchange', clientId: pending.clientId, code, verifier: pending.verifier, redirectUri });
    if (!r.ok) throw new Error(typeof r.json.message === 'string' ? r.json.message : 'Přihlášení u DirectCase se nezdařilo.');
    await saveConnection(master, userId, { clientId: pending.clientId, tokens: r.json.tokens as OAuthTokens });
}

export async function saveConnection(master: CryptoKey, userId: string, c: Connection) {
    const enc = await encryptText(master, JSON.stringify(c));
    const { error } = await supabase.from('legal_connections').upsert({ user_id: userId, client_id: c.clientId, enc_token: enc, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
}

export async function loadConnection(master: CryptoKey): Promise<Connection | null | 'broken'> {
    const { data, error } = await supabase.from('legal_connections').select('enc_token').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    try { return JSON.parse(await decryptText(master, String(data.enc_token))) as Connection; } catch { return 'broken'; }
}

export async function disconnect() { await supabase.from('legal_connections').delete().neq('user_id', '00000000-0000-0000-0000-000000000000'); }

// Platný přístupový token; když brzy vyprší, obnoví se a uloží
export async function validToken(master: CryptoKey, userId: string, c: Connection): Promise<{ token: string; connection: Connection }> {
    if (c.tokens.expires_at - Date.now() > 60_000) return { token: c.tokens.access_token, connection: c };
    if (!c.tokens.refresh_token) throw new Error('Přihlášení k DirectCase vypršelo. Připojte se znovu.');
    const r = await legalApi({ action: 'refresh', clientId: c.clientId, refreshToken: c.tokens.refresh_token });
    if (!r.ok) throw new Error('Přihlášení k DirectCase vypršelo. Připojte se znovu.');
    const next: Connection = { clientId: c.clientId, tokens: { ...(r.json.tokens as OAuthTokens), refresh_token: (r.json.tokens as OAuthTokens).refresh_token ?? c.tokens.refresh_token } };
    await saveConnection(master, userId, next);
    return { token: next.tokens.access_token, connection: next };
}
