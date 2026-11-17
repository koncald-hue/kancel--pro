import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    findActiveLink: vi.fn(),
    rateLimited: vi.fn(),
    insert: vi.fn(),
}));
vi.mock('@/lib/serverSupabase', () => ({
    clientIp: () => 'test-ip',
    findActiveLink: m.findActiveLink,
    rateLimited: m.rateLimited,
    serviceClient: () => ({ from: () => ({ insert: m.insert }) }),
}));

import { POST as sendMessage } from './message/route';
import { POST as uploadFile } from './upload/route';
import { GET as downloadFile } from './file/[id]/route';

const params = Promise.resolve({ token: 'a'.repeat(48), id: 'file-1' });

describe('client file and message routes before onboarding', () => {
    beforeEach(() => {
        m.findActiveLink.mockReset().mockResolvedValue({ verified: true, subscribed: true, onboarded_at: null, e2ee: false });
        m.rateLimited.mockReset().mockResolvedValue(false);
        m.insert.mockReset();
    });

    it.each([
        ['message', () => sendMessage(new Request('http://x/api/portal/token/message', { method: 'POST', body: JSON.stringify({ body: 'test zpráva' }) }), { params })],
        ['upload', () => uploadFile(new Request('http://x/api/portal/token/upload', { method: 'POST' }), { params: Promise.resolve({ token: 'a'.repeat(48) }) })],
        ['download', () => downloadFile(new Request('http://x/api/portal/token/file/file-1'), { params })],
    ])('denies %s until the client completes onboarding', async (_name, call) => {
        const response = await call();
        expect(response.status).toBe(403);
        expect(m.insert).not.toHaveBeenCalled();
    });
});
