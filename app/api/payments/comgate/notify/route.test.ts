import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn(async () => ({ data: 'ok', error: null }));
const single = vi.fn(async () => ({ data: { price_czk: 490 } }));
const eqStatus = vi.fn(async () => ({}));
vi.mock('@/lib/serverSupabase', () => ({ serviceClient: () => ({ rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: single }) }), update: () => ({ eq: () => ({ eq: eqStatus }) }) }) }) }));

import { POST } from './route';

const ORDER = '123e4567-e89b-12d3-a456-426614174000';
const notify = (transId = 'AB12-CD34-EF56') => new Request('http://x/api/payments/comgate/notify', { method: 'POST', body: new URLSearchParams({ transId }) });
const gateway = (o: Record<string, string>) => vi.stubGlobal('fetch', vi.fn(async () => new Response(new URLSearchParams({ code: '0', message: 'OK', status: 'PAID', refId: ORDER, price: '49000', curr: 'CZK', test: 'false', ...o }).toString())));

describe('comgate notify', () => {
    beforeEach(() => { rpc.mockClear(); process.env.COMGATE_MERCHANT = 'm'; process.env.COMGATE_SECRET = 's'; delete process.env.COMGATE_TEST; });

    it('is unavailable without configuration', async () => {
        delete process.env.COMGATE_MERCHANT;
        expect((await POST(notify())).status).toBe(503);
    });
    it('applies a verified payment', async () => {
        gateway({});
        expect((await POST(notify())).status).toBe(200);
        expect(rpc).toHaveBeenCalledWith('apply_lawyer_payment', { p_order: ORDER, p_ref: 'comgate:AB12-CD34-EF56' });
    });
    it('refuses a wrong amount, a test payment in live mode and unpaid status', async () => {
        for (const o of [{ price: '100' }, { test: 'true' }, { curr: 'EUR' }] as Record<string, string>[]) { gateway(o); expect((await POST(notify())).status).toBe(400); }
        gateway({ status: 'PENDING' }); expect((await POST(notify())).status).toBe(200);
        expect(rpc).not.toHaveBeenCalled();
    });
    it('rejects a malformed transaction id', async () => {
        expect((await POST(notify('../x'))).status).toBe(400);
    });
});
