// Minimální klient MCP (Streamable HTTP) a OAuth 2.1 pomůcky pro právní vyhledávač DirectCase.
// Používá se jen na serveru; přístupové tokeny uživatele přicházejí s jedním požadavkem a neukládají se.
export const DIRECTCASE_URL = 'https://mcp.directcase.ai/';
export const DIRECTCASE_REGISTER = 'https://mcp.directcase.ai/oauth2/register';
export const DIRECTCASE_AUTHORIZE = 'https://login.directcase.ai/oauth2/authorize';
export const DIRECTCASE_TOKEN = 'https://login.directcase.ai/oauth2/token';
// Adresa v naší aplikaci, na kterou DirectCase po přihlášení vrátí uživatele
export const CALLBACK_PATH = '/kancelar/pravni-pripojeni';
export const OAUTH_SCOPE = 'openid profile email offline_access';

export type OAuthTokens = { access_token: string; refresh_token?: string; expires_at: number };

// Odpověď může být JSON, nebo proud událostí (SSE) s řádky „data: {...}“; hledá se zpráva s daným id
export function parseRpc(body: string, id: number): { result?: unknown; error?: { message?: string } } | null {
    const candidates: string[] = [];
    const trimmed = body.trim();
    if (trimmed.startsWith('{')) candidates.push(trimmed);
    for (const line of body.split(/\r?\n/)) if (line.startsWith('data:')) candidates.push(line.slice(5).trim());
    for (const c of candidates) {
        try { const j = JSON.parse(c) as { id?: number; result?: unknown; error?: { message?: string } }; if (j.id === id) return j; } catch { /* další kandidát */ }
    }
    return null;
}

// Výsledek nástroje: text z content[], ten bývá JSON (někdy zabalený ještě jednou do pole „result“)
export function toolPayload(result: unknown): unknown {
    const content = (result as { content?: { type?: string; text?: string }[] } | undefined)?.content;
    const text = content?.find((c) => c.type === 'text')?.text ?? '';
    let v: unknown = text;
    for (let i = 0; i < 3 && typeof v === 'string'; i++) { try { v = JSON.parse(v); } catch { break; } }
    if (v && typeof v === 'object' && 'result' in (v as object) && typeof (v as { result: unknown }).result === 'string') { try { v = JSON.parse((v as { result: string }).result); } catch { /* nechá se */ } }
    return v;
}

export class McpError extends Error { constructor(message: string, public status = 0) { super(message); } }

export async function mcpConnect(token: string, url = DIRECTCASE_URL) {
    let sessionId = '';
    let nextId = 1;
    const base: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}`, 'MCP-Protocol-Version': '2025-03-26' };
    const post = async (payload: Record<string, unknown>, id?: number) => {
        const res = await fetch(url, { method: 'POST', headers: { ...base, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) }, body: JSON.stringify(payload), cache: 'no-store', signal: AbortSignal.timeout(90_000) });
        if (res.status === 401 || res.status === 403) throw new McpError('Přihlášení k právnímu vyhledávači vypršelo nebo bylo odmítnuto.', res.status);
        if (!res.ok && res.status !== 202) throw new McpError(`Právní vyhledávač vrátil chybu ${res.status}.`, res.status);
        const sid = res.headers.get('mcp-session-id'); if (sid) sessionId = sid;
        const text = await res.text();
        if (id === undefined) return null;
        const rpc = parseRpc(text, id);
        if (!rpc) throw new McpError('Právní vyhledávač vrátil nečitelnou odpověď.');
        if (rpc.error) throw new McpError(rpc.error.message ?? 'Chyba právního vyhledávače.');
        return rpc.result;
    };
    const initId = nextId++;
    await post({ jsonrpc: '2.0', id: initId, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'Kancelar', version: '1.0' } } }, initId);
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    return {
        async call(name: string, args: Record<string, unknown>): Promise<unknown> {
            const id = nextId++;
            const result = await post({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }, id);
            if ((result as { isError?: boolean })?.isError) throw new McpError('Právní vyhledávač nástroj odmítl.');
            return toolPayload(result);
        },
    };
}

// ---------- OAuth: registrace klienta, výměna kódu, obnova tokenu ----------
export async function registerClient(redirectUri: string): Promise<string> {
    const res = await fetch(DIRECTCASE_REGISTER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Kancelář', redirect_uris: [redirectUri], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: OAUTH_SCOPE }), cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new McpError(`Registrace aplikace u DirectCase se nezdařila (${res.status}).`, res.status);
    const j = await res.json() as { client_id?: string };
    if (!j.client_id) throw new McpError('DirectCase nevrátil identifikátor aplikace.');
    return j.client_id;
}

async function tokenRequest(params: Record<string, string>): Promise<OAuthTokens> {
    const res = await fetch(DIRECTCASE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(params), cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    const j = await res.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
    if (!res.ok || !j.access_token) throw new McpError(j.error_description || j.error || `Přihlášení u DirectCase se nezdařilo (${res.status}).`, res.status);
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in ?? 3600) * 1000 };
}
export const exchangeCode = (p: { clientId: string; code: string; verifier: string; redirectUri: string }) => tokenRequest({ grant_type: 'authorization_code', client_id: p.clientId, code: p.code, code_verifier: p.verifier, redirect_uri: p.redirectUri, resource: DIRECTCASE_URL });
export const refreshTokens = (p: { clientId: string; refreshToken: string }) => tokenRequest({ grant_type: 'refresh_token', client_id: p.clientId, refresh_token: p.refreshToken, resource: DIRECTCASE_URL });

// Adresa pro přesměrování uživatele na přihlášení (PKCE S256); skládá se v prohlížeči
export const authorizeUrl = (p: { clientId: string; redirectUri: string; challenge: string; state: string }) =>
    `${DIRECTCASE_AUTHORIZE}?${new URLSearchParams({ response_type: 'code', client_id: p.clientId, redirect_uri: p.redirectUri, scope: OAUTH_SCOPE, code_challenge: p.challenge, code_challenge_method: 'S256', state: p.state, resource: DIRECTCASE_URL })}`;
