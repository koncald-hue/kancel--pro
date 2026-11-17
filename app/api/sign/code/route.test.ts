import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    authGetUser: vi.fn(),
    requestRow: vi.fn(),
    rpc: vi.fn(),
    rateLimited: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        auth: { getUser: m.authGetUser },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.requestRow }) }) }),
    }),
}));
vi.mock('@/lib/serverSupabase', () => ({
    rateLimited: m.rateLimited,
    serviceClient: () => ({ rpc: m.rpc }),
}));

import { POST } from './route';

const request = () => new Request('http://x/api/sign/code', {
    method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000001' }),
});

describe('lawyer OTP generation', () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
        m.authGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'lawyer-1' } }, error: null });
        m.requestRow.mockReset().mockResolvedValue({ data: { id: 'signature-1', status: 'pending', level: 'advanced', expires_at: null }, error: null });
        m.rpc.mockReset().mockResolvedValue({ data: 'ok', error: null });
        m.rateLimited.mockReset().mockResolvedValue(false);
    });

    it('requires a verified authenticated user before issuing a code', async () => {
        m.authGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
        const response = await POST(request());
        expect(response.status).toBe(401);
        expect(m.rpc).not.toHaveBeenCalled();
    });

    it('applies a per-lawyer limit and the atomic per-request OTP limit', async () => {
        const response = await POST(request());
        expect(response.status).toBe(200);
        expect(m.rateLimited).toHaveBeenCalledWith('sign-code:lawyer-1', 20, 60 * 60_000);
        expect(m.rpc).toHaveBeenCalledWith('issue_signature_otp', expect.objectContaining({
            p_request: 'signature-1', p_channel: 'lawyer', p_max_sends: 3,
        }));
        expect((await response.json()).code).toMatch(/^\d{6}$/);
    });

    it('rejects requests after the atomic per-request OTP limit', async () => {
        m.rpc.mockResolvedValue({ data: 'limit', error: null });
        const response = await POST(request());
        expect(response.status).toBe(429);
    });
});
