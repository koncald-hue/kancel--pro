import { describe, expect, it } from 'vitest';
import { insView, type ClientIns } from './clientInsolvency';

const base: ClientIns = { client_id: '1', ic: '27082440', watched: true, last_checked_at: '2026-11-16T10:00:00Z', last_error: '', active_count: 0, ended_count: 0, spis: null, state: null, url: null };

describe('client insolvency view', () => {
    it('says what is going on for each state', () => {
        expect(insView(undefined, false).tone).toBe('none');
        expect(insView(undefined, true).tone).toBe('wait');
        expect(insView({ ...base, watched: false }, true).tone).toBe('wait');
        expect(insView({ ...base, last_checked_at: null }, true).text).toBe('čeká na první kontrolu');
        expect(insView(base, true)).toMatchObject({ tone: 'ok', text: 'bez nálezu' });
        expect(insView({ ...base, ended_count: 1 }, true).tone).toBe('ended');
    });
    it('shows insolvency first, with state and case number', () => {
        const v = insView({ ...base, active_count: 1, state: 'Konkurs', spis: '92 INS 19385/2025' }, true);
        expect(v).toEqual({ tone: 'bad', text: 'V INSOLVENCI', detail: 'Konkurs · 92 INS 19385/2025' });
    });
    it('reports a failed check when there was never a successful one', () => {
        expect(insView({ ...base, last_checked_at: null, last_error: 'Rejstřík neodpovídá' }, true).tone).toBe('error');
    });
});
