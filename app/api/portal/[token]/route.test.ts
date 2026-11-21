import { describe, expect, it, vi } from 'vitest';
import { generateToken } from '@/lib/portal';

const token = generateToken();
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {
    client_links: [{ id: 'l1', case_id: 'c1', user_id: 'secret-lawyer-id', token, label: 'Moje spisy', status_text: 'Čekáme', expires_at: null, revoked: false, opens: 0, onboarded_at: '2026-11-01', client_name: 'Klient' }],
    lawyer_access: [{ firm_name: 'AK Novák', display_name: 'JUDr. Novák', verification_status: 'verified', profession: 'advokat', verified_at: '2026-11-01', bar_number: '12345', status: 'active', until: '2999-01-01' }],
    cases: [{ title: 'Interní název' }],
    client_requests: [{ id: 'r1', title: 'Smlouva', done: false }],
    case_files: [{ id: 'f1', name: 'verejny.pdf', size: 10, created_at: '2026-11-01', source: 'lawyer', request_id: null, client_visible: true }],
    case_entries: [], case_deadlines: [], client_messages: [],
};

vi.mock('@/lib/serverSupabase', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/serverSupabase')>();
    const from = (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'or', 'order', 'update']) chain[m] = () => chain;
        chain.maybeSingle = async () => ({ data: tables[table]?.[0] ?? null });
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [] }).then(resolve);
        return chain;
    };
    return { ...original, serviceClient: () => ({ from }) };
});

import { GET } from './route';

describe('client portal API', () => {
    it('returns only client-facing fields and never the lawyer id', async () => {
        const res = await GET(new Request('http://x/api/portal/t'), { params: Promise.resolve({ token }) });
        expect(res.status).toBe(200);
        const text = JSON.stringify(await res.json());
        expect(text).toContain('AK Novák');
        expect(text).toContain('Moje spisy');
        expect(text).not.toContain('secret-lawyer-id');
        expect(text).not.toContain('Interní název');
    });

    it('answers 404 for a malformed token', async () => {
        const res = await GET(new Request('http://x/api/portal/zly'), { params: Promise.resolve({ token: 'zly' }) });
        expect(res.status).toBe(404);
    });

    it('hides the case until the client has filled in their details', async () => {
        (tables.client_links[0] as Record<string, unknown>).onboarded_at = null;
        const res = await GET(new Request('http://x/api/portal/t'), { params: Promise.resolve({ token }) });
        const body = await res.json();
        (tables.client_links[0] as Record<string, unknown>).onboarded_at = '2026-11-01';
        expect(body.onboarded).toBe(false);
        expect(body.lawyer.name).toBe('JUDr. Novák');
        expect(JSON.stringify(body)).not.toContain('verejny.pdf');
        expect(body.files).toBeUndefined();
    });

    it('refuses to serve a link of an unverified lawyer', async () => {
        (tables.lawyer_access[0] as Record<string, unknown>).verification_status = 'pending';
        const res = await GET(new Request('http://x/api/portal/t'), { params: Promise.resolve({ token }) });
        const body = await res.json();
        (tables.lawyer_access[0] as Record<string, unknown>).verification_status = 'verified';
        expect(body.unverified).toBe(true);
        expect(JSON.stringify(body)).not.toContain('Moje spisy');
    });

    it('stops serving the client page when the subscription has expired', async () => {
        (tables.lawyer_access[0] as Record<string, unknown>).until = '2000-01-01';
        const res = await GET(new Request('http://x/api/portal/t'), { params: Promise.resolve({ token }) });
        const body = await res.json();
        (tables.lawyer_access[0] as Record<string, unknown>).until = '2999-01-01';
        expect(body.inactive).toBe(true);
        expect(JSON.stringify(body)).not.toContain('Moje spisy');
    });
});
