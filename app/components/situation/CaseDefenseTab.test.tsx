import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaseDefenseTab from './CaseDefenseTab';
import type { TabProps } from './caseUi';

vi.mock('../shop/RelatedDocuments', () => ({ default: () => null }));

const defense = {
    classification: 'Přestupek v dopravě.',
    must_prove: ['Že jste vozidlo řídil vy'],
    angles: [{ title: 'Chybné doručení', explanation: 'Zkontrolujte datum doručení.', check: 'Doručenku' }],
    procedural_checks: ['Poučení o opravném prostředku'],
    evidence: ['Fotky místa'],
    plan: [{ step: 'Podat odpor', when: 'do 8 dnů', detail: 'Napište odpor.' }],
    risks: ['Chybí důkaz'],
    questions: ['Kdy vám došlo oznámení?'],
    judikatura: [{ id: 'l1', why: 'Řeší doručování.' }],
    search_terms: ['doručení trestního příkazu'],
    when_lawyer: 'Při obvinění z trestného činu jděte k advokátovi.',
};

vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: { getSession: async () => ({ data: { session: null } }) },
        from: (table: string) => {
            const result = table === 'cases'
                ? { data: { defense, defense_at: '2026-11-15T10:00:00Z' }, error: null }
                : { data: [{ id: 'l1', court: 'Nejvyšší soud', ref: '4 Tdo 1/2020', ecli: '', decided_on: null, title: 't', holding: 'Doručení musí být prokázáno.', url: 'https://example.org/x' }], error: null };
            const chain: Record<string, unknown> = { select: () => chain, eq: () => chain, in: () => chain, maybeSingle: async () => result, then: (r: (v: unknown) => unknown) => Promise.resolve(result).then(r) };
            return chain;
        },
    },
}));

afterEach(cleanup);

describe('CaseDefenseTab', () => {
    it('shows the saved strategy with verified case law and a disclaimer', async () => {
        const props = { item: { id: 'c1', situation: 'Pokuta', steps: [], template_keys: [] }, bundle: { entries: [] }, userId: 'u1', lawyer: false, patchItem: vi.fn(), setBundle: vi.fn(), fail: vi.fn() } as unknown as TabProps;
        render(<CaseDefenseTab {...props} />);
        await waitFor(() => expect(screen.getByText('Podat odpor')).toBeTruthy());
        expect(screen.getByText('Chybné doručení')).toBeTruthy();
        await waitFor(() => expect(screen.getByText(/4 Tdo 1\/2020/)).toBeTruthy());
        expect(screen.getByText(/nikoli právní radu/)).toBeTruthy();
        expect(screen.getByRole('link', { name: /Rozhodnutí v databázi soudu/ })).toBeTruthy();
    });
});
