import { describe, expect, it } from 'vitest';
import { authorizeUrl, bankIdConfig, discover, exchangeCode, identityComplete, normalizeUserinfo, pkceChallenge, sameName } from './bankid';

const cfg = { clientId: 'cid', clientSecret: 'sec', base: 'https://oidc.sandbox.bankid.cz', scopes: 'openid profile.name', redirectUri: 'https://app.example/api/identity/bankid/callback' };
const ep = { authorization_endpoint: 'https://oidc.sandbox.bankid.cz/auth', token_endpoint: 'https://oidc.sandbox.bankid.cz/token', userinfo_endpoint: 'https://oidc.sandbox.bankid.cz/userinfo' };

describe('Bank iD', () => {
    it('is off without credentials and defaults to the sandbox', () => {
        delete process.env.BANKID_CLIENT_ID; delete process.env.BANKID_CLIENT_SECRET;
        expect(bankIdConfig('https://x.cz')).toBeNull();
        process.env.BANKID_CLIENT_ID = 'a'; process.env.BANKID_CLIENT_SECRET = 'b';
        expect(bankIdConfig('https://x.cz/')).toMatchObject({ base: 'https://oidc.sandbox.bankid.cz', redirectUri: 'https://x.cz/api/identity/bankid/callback' });
        delete process.env.BANKID_CLIENT_ID; delete process.env.BANKID_CLIENT_SECRET;
    });
    it('computes the PKCE challenge from RFC 7636', async () => {
        expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    });
    it('builds the authorization URL with state, nonce and S256 challenge', async () => {
        const u = new URL(await authorizeUrl(cfg, ep, { state: 'st', nonce: 'no', verifier: 'v' }));
        expect(u.origin + u.pathname).toBe('https://oidc.sandbox.bankid.cz/auth');
        expect(u.searchParams.get('code_challenge_method')).toBe('S256');
        expect(u.searchParams.get('state')).toBe('st');
        expect(u.searchParams.get('redirect_uri')).toBe(cfg.redirectUri);
    });
    it('rejects discovery documents pointing to another domain', async () => {
        const evil = async () => new Response(JSON.stringify({ ...ep, token_endpoint: 'https://evil.example/token' }));
        await expect(discover(cfg, evil as unknown as typeof fetch)).rejects.toThrow();
        const ok = async () => new Response(JSON.stringify(ep));
        await expect(discover(cfg, ok as unknown as typeof fetch)).resolves.toMatchObject(ep);
    });
    it('exchanges the code and normalizes the identity', async () => {
        const calls: string[] = [];
        const f = (async (url: string) => { calls.push(url); return new Response(JSON.stringify(url.endsWith('/token') ? { access_token: 'AT' } : { sub: 'u1', given_name: 'Jan', family_name: 'Novák', birthdate: '1985-03-02', phone_number: '+420777123456', addresses: [{ street: 'Dlouhá', streetnumber: '12', city: 'Plzeň', zipcode: '30100' }] })); }) as unknown as typeof fetch;
        const id = await exchangeCode(cfg, ep, 'code', 'ver', f);
        expect(calls).toEqual([ep.token_endpoint, ep.userinfo_endpoint]);
        expect(id).toMatchObject({ sub: 'u1', given: 'Jan', family: 'Novák', birthdate: '1985-03-02', phone: '+420777123456', address: 'Dlouhá 12, 30100 Plzeň' });
        expect(identityComplete(id)).toBe(true);
        expect(identityComplete(normalizeUserinfo({ sub: 'x' }))).toBe(false);
    });
    it('compares names regardless of diacritics, case and order', () => {
        expect(sameName('Jan Novák', 'novak JAN')).toBe(true);
        expect(sameName('Jan Novák', 'Jan Novotný')).toBe(false);
    });
});
