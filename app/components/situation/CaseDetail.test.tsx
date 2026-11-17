import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaseDetail from './CaseDetail';

vi.mock('next/link', () => ({ default: ({ href, children, ...p }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...p}>{children}</a> }));
vi.mock('next/navigation', () => ({ usePathname: () => '/moje-pripady/c1', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../site/AuthContext', () => ({ useAuth: () => ({ account: { id: 'u1' }, authReady: true, isStaff: false, openLogin: vi.fn(), logout: vi.fn() }) }));
vi.mock('../shop/RelatedDocuments', () => ({ default: () => null }));
vi.mock('@/lib/lawyer', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/lawyer')>()), useLawyerAccess: () => ({ loading: false, access: null, error: '' }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => { const c: Record<string, unknown> = new Proxy({}, { get: (_t, prop) => (prop === 'then' ? (r: (v: unknown) => unknown) => Promise.resolve({ count: 0, data: [], error: null }).then(r) : () => c) }); return c; },
} }));

const today = new Date();
const iso = (offset: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

vi.mock('@/lib/cases', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/cases')>()),
    loadCase: async () => ({ id: 'c1', title: 'Spor s e-shopem', situation: '', summary: 'Shrnutí sporu', urgency: 'medium', steps: [{ text: 'Napsat reklamaci', done: true }, { text: 'Čekat na odpověď', done: false }], deadline_ids: [], offense_ids: [], template_keys: [], event_date: null, note: '', status: 'open', pinned: false, created_at: '2026-11-01T10:00:00Z' }),
    updateCase: async () => undefined,
}));
vi.mock('@/lib/caseFile', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/caseFile')>()),
    loadBundle: async () => ({
        folders: [{ id: 'f1', case_id: 'c1', name: 'Důkazy' }],
        files: [{ id: 'x1', case_id: 'c1', folder_id: 'f1', name: 'faktura.pdf', path: 'u1/c1/faktura.pdf', size: 2048, mime: 'application/pdf', note: '', created_at: '2026-11-02T10:00:00Z' }],
        entries: [{ id: 'e1', case_id: 'c1', kind: 'event', title: 'Vrácen balík', body: '', happened_on: '2026-11-03', pinned: false, created_at: '2026-11-03T10:00:00Z' }],
        deadlines: [{ id: 'd1', case_id: 'c1', title: 'Jednání u soudu', due_date: iso(2), done: false }],
        contacts: [{ id: 'k1', case_id: 'c1', role: 'Soud', name: 'Okresní soud', email: 'podatelna@soud.cz', phone: '', note: '' }],
    }),
}));

afterEach(cleanup);

describe('CaseDetail', () => {
    it('shows the overview, upcoming deadline and every tab', async () => {
        render(<CaseDetail />);
        await waitFor(() => expect(screen.getByLabelText('Název případu')).toBeTruthy());
        expect((screen.getByLabelText('Název případu') as HTMLInputElement).value).toBe('Spor s e-shopem');
        expect(screen.getByText(/Nejbližší lhůta: Jednání u soudu · za 2 dny/)).toBeTruthy();
        expect(screen.getByText('1 z 2 hotovo')).toBeTruthy();

        expect(screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, '').trim())).toEqual(['Přehled', 'Obrana', 'Soubory', 'Lhůty', 'Chronologie', 'Kontakty']);
        fireEvent.click(screen.getByRole('tab', { name: /Soubory/ }));
        expect(screen.getByText('faktura.pdf')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: /Chronologie/ }));
        expect(screen.getByText('Vrácen balík')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: /Kontakty/ }));
        expect(screen.getByText('podatelna@soud.cz')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: /Lhůty/ }));
        expect(screen.getAllByText('Jednání u soudu').length).toBeGreaterThan(0);
    });
});
