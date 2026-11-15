import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = { user: { id: 'u1' } as { id: string } | null, staff: false, access: { status: 'active', until: null, verification_status: 'verified' } as Record<string, unknown> | null };
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        auth: { getUser: async () => ({ data: { user: state.user }, error: state.user ? null : new Error('x') }) },
        rpc: async () => ({ data: state.staff }),
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.access }) }) }) }),
    }),
}));

import { GET } from './route';

const req = (query: string, auth = true) => new Request(`http://x/api/katastr?${query}`, { headers: auth ? { authorization: 'Bearer t' } : {} });
const realFetch = globalThis.fetch;

beforeEach(() => { process.env.CUZK_API_KEY = 'test-key'; state.user = { id: 'u1' }; state.staff = false; state.access = { status: 'active', until: null, verification_status: 'verified' }; });
afterEach(() => { globalThis.fetch = realFetch; delete process.env.CUZK_API_KEY; });

describe('/api/katastr', () => {
    it('is switched off until the ČÚZK key is configured', async () => {
        delete process.env.CUZK_API_KEY;
        expect((await GET(req('op=ku&q=plzen'))).status).toBe(503);
    });

    it('requires a signed-in lawyer with a completed profile', async () => {
        expect((await GET(req('op=ku&q=plzen', false))).status).toBe(401);
        state.access = { status: 'active', until: null, verification_status: 'none' };
        expect((await GET(req('op=ku&q=plzen'))).status).toBe(403);
        state.access = { status: 'expired', until: '2000-01-01', verification_status: 'verified' };
        expect((await GET(req('op=ku&q=plzen'))).status).toBe(403);
    });

    it('rejects malformed parcel searches without calling ČÚZK', async () => {
        const spy = vi.fn(); globalThis.fetch = spy as unknown as typeof fetch;
        expect((await GET(req('op=parcela&ku=abc&kmen=1'))).status).toBe(400);
        expect((await GET(req('op=parcela&ku=700001&kmen=0'))).status).toBe(400);
        expect(spy).not.toHaveBeenCalled();
    });

    it('calls ČÚZK with the key in the ApiKey header and returns a normalized parcel', async () => {
        const spy = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 7, typParcely: 'PKN', druhCislovaniParcely: 2, kmenoveCisloParcely: 12, katastralniUzemi: { kod: 700001, nazev: 'Plzeň' }, vymera: 100 }], aktualnostDatK: '2026-11-14' }), { status: 200 }));
        globalThis.fetch = spy as unknown as typeof fetch;
        const res = await GET(req('op=parcela&ku=700001&kmen=12&druh=2'));
        const body = await res.json();
        expect(body.found).toBe(true);
        expect(body.parcels[0]).toMatchObject({ id: 7, oznaceni: '12', vymera: 100 });
        const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toContain('https://api-kn.cuzk.gov.cz/api/v1/Parcely/Vyhledani?');
        expect((init.headers as Record<string, string>).ApiKey).toBe('test-key');
        expect(JSON.stringify(body)).not.toContain('test-key');
    });

    it('reports an unknown parcel as not found', async () => {
        globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
        expect(await (await GET(req('op=parcela&ku=700001&kmen=999'))).json()).toEqual({ found: false });
    });

    it('validates building, unit and proceeding searches before calling ČÚZK', async () => {
        const spy = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 5, typStavby: { kod: 1, nazev: 'budova' }, cislaDomovni: [327] }] }), { status: 200 }));
        globalThis.fetch = spy as unknown as typeof fetch;
        expect((await GET(req('op=stavba&co=abc&typ=1&cp=1'))).status).toBe(400);
        expect((await GET(req('op=jednotka&co=1&typ=1&cp=1'))).status).toBe(400);
        expect((await GET(req('op=rizeni&typ=XX&cislo=1&rok=2026&ws=101'))).status).toBe(400);
        expect(spy).not.toHaveBeenCalled();
        const ok = await (await GET(req('op=stavba&co=406392&typ=1&cp=327'))).json();
        expect(ok.items[0]).toMatchObject({ id: 5, cisla: '327' });
        expect((spy.mock.calls[0] as unknown as [string])[0]).toContain('/api/v1/Stavby/Vyhledani?KodCastiObce=406392&TypStavby=1&CisloDomovni=327');
    });
});
