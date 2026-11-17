// Ověření totožnosti přes Bank iD (OpenID Connect). Běží jen na serveru. Bez nastavení BANKID_CLIENT_ID a BANKID_CLIENT_SECRET je vypnuté.
// Standardní tok „authorization code“ s PKCE; identita se čte z koncového bodu userinfo, který volá server přímo přes TLS.
export type IdpName = 'bankid' | 'mojeid';
export type BankIdConfig = { provider: IdpName; label: string; clientId: string; clientSecret: string; base: string; scopes: string; redirectUri: string };

// Poskytovatel ověření: Bank iD (výchozí), nebo mojeID (IDENTITY_PROVIDER=mojeid). Oba používají standardní OpenID Connect.
export function bankIdConfig(origin: string): BankIdConfig | null {
    const redirectUri = `${origin.replace(/\/+$/, '')}/api/identity/bankid/callback`;
    if (process.env.IDENTITY_PROVIDER === 'mojeid') {
        const clientId = process.env.MOJEID_CLIENT_ID; const clientSecret = process.env.MOJEID_CLIENT_SECRET;
        if (!clientId || !clientSecret) return null;
        // Bez výslovného nastavení se používá zkušební prostředí mojeID
        return { provider: 'mojeid', label: 'mojeID', clientId, clientSecret, base: (process.env.MOJEID_BASE_URL || 'https://mojeid.regtest.nic.cz').replace(/\/+$/, ''), scopes: process.env.MOJEID_SCOPES || 'openid profile email phone address', redirectUri };
    }
    const clientId = process.env.BANKID_CLIENT_ID; const clientSecret = process.env.BANKID_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    // Bez výslovného nastavení se používá zkušební prostředí, ne ostré
    const base = (process.env.BANKID_BASE_URL || 'https://oidc.sandbox.bankid.cz').replace(/\/+$/, '');
    const scopes = process.env.BANKID_SCOPES || 'openid profile.name profile.birthdate profile.email profile.phonenumber profile.addresses';
    return { provider: 'bankid', label: 'Bank iD', clientId, clientSecret, base, scopes, redirectUri };
}

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomToken = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
export async function pkceChallenge(verifier: string): Promise<string> { return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))); }

export type Endpoints = { authorization_endpoint: string; token_endpoint: string; userinfo_endpoint: string };
export async function discover(cfg: BankIdConfig, f: typeof fetch = fetch): Promise<Endpoints> {
    let res = await f(`${cfg.base}/.well-known/openid-configuration`, { cache: 'no-store' });
    if (!res.ok) res = await f(`${cfg.base}/.well-known/openid-configuration/`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${cfg.label} neodpovídá.`);
    const j = await res.json() as Partial<Endpoints>;
    if (!j.authorization_endpoint || !j.token_endpoint || !j.userinfo_endpoint) throw new Error('Bank iD vrátil neúplné nastavení.');
    // Koncové body musí patřit pod stejnou doménu jako zadaná adresa Bank iD
    const host = new URL(cfg.base).hostname.toLowerCase();
    const trustedDomain = host.split('.').slice(-2).join('.');
    for (const u of [j.authorization_endpoint, j.token_endpoint, j.userinfo_endpoint]) {
        const endpoint = new URL(u);
        const endpointHost = endpoint.hostname.toLowerCase();
        const trustedHost = endpointHost === trustedDomain || endpointHost.endsWith(`.${trustedDomain}`);
        if (endpoint.protocol !== 'https:' || !trustedHost) throw new Error('Bank iD vrátil nedůvěryhodnou adresu.');
    }
    return j as Endpoints;
}

export async function authorizeUrl(cfg: BankIdConfig, ep: Endpoints, p: { state: string; nonce: string; verifier: string }): Promise<string> {
    const u = new URL(ep.authorization_endpoint);
    const q = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: cfg.scopes, state: p.state, nonce: p.nonce, code_challenge: await pkceChallenge(p.verifier), code_challenge_method: 'S256' });
    // mojeID: příznak ověření účtu se musí vyžádat výslovně
    if (cfg.provider === 'mojeid') q.set('claims', JSON.stringify({ userinfo: { mojeid_valid: null } }));
    u.search = q.toString();
    return u.toString();
}

export type VerifiedIdentity = { sub: string; given: string; family: string; birthdate: string; email: string; phone: string; address: string; txn: string; validated?: boolean };
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
export function normalizeUserinfo(j: Record<string, unknown>): VerifiedIdentity {
    const a = (Array.isArray(j.addresses) ? j.addresses[0] : j.address) as Record<string, unknown> | undefined;
    const zip = a ? s(a.zipcode) || s(a.postal_code) : ''; const town = a ? s(a.city) || s(a.locality) : '';
    const street = a ? [s(a.street), [s(a.buildingapartment), s(a.streetnumber)].filter(Boolean).join('/')].filter(Boolean).join(' ') : '';
    const address = a ? [street || s(a.street_address), [zip, town].filter(Boolean).join(' ')].filter(Boolean).join(', ') || s(a.formatted) : '';
    return { sub: s(j.sub), given: s(j.given_name), family: s(j.family_name), birthdate: s(j.birthdate), email: s(j.email), phone: s(j.phone_number), address, txn: s(j.txn), validated: j.mojeid_valid === undefined ? undefined : j.mojeid_valid === true || j.mojeid_valid === 'true' };
}
// U mojeID se totožnost uzná jen u ověřeného účtu (příznak mojeid_valid); neověřený účet si může kdokoli založit s libovolným jménem
export const identityComplete = (i: VerifiedIdentity, provider: IdpName = 'bankid') => !!i.sub && !!i.given && !!i.family && /^\d{4}-\d{2}-\d{2}$/.test(i.birthdate) && (provider !== 'mojeid' || i.validated === true);

export async function exchangeCode(cfg: BankIdConfig, ep: Endpoints, code: string, verifier: string, f: typeof fetch = fetch): Promise<VerifiedIdentity> {
    const tok = await f(ep.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, client_id: cfg.clientId, client_secret: cfg.clientSecret, code_verifier: verifier }).toString(), cache: 'no-store' });
    if (!tok.ok) throw new Error('Bank iD odmítl ověření.');
    const t = await tok.json() as { access_token?: string };
    if (!t.access_token) throw new Error('Bank iD nevrátil přístup.');
    const ui = await f(ep.userinfo_endpoint, { headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json' }, cache: 'no-store' });
    if (!ui.ok) throw new Error('Bank iD nevydal údaje o totožnosti.');
    return normalizeUserinfo(await ui.json() as Record<string, unknown>);
}

export { sameName } from './signing';
