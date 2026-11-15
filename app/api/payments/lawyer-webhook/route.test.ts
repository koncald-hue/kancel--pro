import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

const rpc = vi.fn(async () => ({ data: 'ok', error: null }));
vi.mock('@/lib/serverSupabase', () => ({ serviceClient: () => ({ rpc }) }));

import { POST } from './route';

const ORDER = '123e4567-e89b-12d3-a456-426614174000';
const sign = (secret: string, ref: string) => createHmac('sha256', secret).update(`${ORDER}.${ref}`).digest('hex');
const request = (body: unknown, signature: string) => new Request('http://x/api/payments/lawyer-webhook', { method: 'POST', headers: { 'x-signature': signature, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('lawyer payment webhook', () => {
    it('is unavailable without a configured secret', async () => {
        delete process.env.PAYMENT_WEBHOOK_SECRET;
        expect((await POST(request({ orderId: ORDER, reference: 'r1' }, 'aa'))).status).toBe(503);
    });

    it('rejects a wrong signature and applies a correct one', async () => {
        process.env.PAYMENT_WEBHOOK_SECRET = 'tajemstvi';
        expect((await POST(request({ orderId: ORDER, reference: 'r1' }, sign('jine', 'r1')))).status).toBe(403);
        expect(rpc).not.toHaveBeenCalled();
        const ok = await POST(request({ orderId: ORDER, reference: 'r1' }, sign('tajemstvi', 'r1')));
        expect(ok.status).toBe(200);
        expect(rpc).toHaveBeenCalledWith('apply_lawyer_payment', { p_order: ORDER, p_ref: 'r1' });
        delete process.env.PAYMENT_WEBHOOK_SECRET;
    });
});
