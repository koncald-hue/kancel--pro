import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLawyers from './AdminLawyers';
import type { LawyerAccess } from '@/lib/lawyer';

vi.mock('@/lib/supabase', () => ({
    supabase: { from: () => ({ select: () => Promise.resolve({ data: [
        { user_id: 'a', status: 'paid', price_czk: 1490, paid_at: new Date().toISOString() },
        { user_id: 'b', status: 'refund_due', price_czk: 1490, paid_at: null },
    ] }) }) },
}));

afterEach(cleanup);

const row = (over: Partial<LawyerAccess>): LawyerAccess => ({ user_id: 'x', email: 'x@x.cz', status: 'active', until: '2999-01-01', firm_name: '', default_rate: 0, verification_status: 'verified', ...over });

describe('AdminLawyers', () => {
    it('shows contact data, subscription state and revenue, and filters', async () => {
        const rows = [
            row({ user_id: 'a', email: 'novak@ak.cz', register_name: 'JUDr. Jan Novák', bar_number: '12345' }),
            row({ user_id: 'b', email: 'dvorak@ak.cz', register_name: 'JUDr. Petr Dvořák', verification_status: 'pending', status: 'expired', until: null }),
        ];
        render(<AdminLawyers rows={rows} onSet={vi.fn()} onRevoke={vi.fn()} />);
        expect(screen.getByText('JUDr. Jan Novák')).toBeTruthy();
        expect(screen.getByText(/novak@ak.cz/)).toBeTruthy();
        expect((await screen.findAllByText('1 490 Kč', { selector: 'p' })).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole('button', { name: 'Čekají na ověření' }));
        expect(screen.queryByText('JUDr. Jan Novák')).toBeNull();
        expect(screen.getByText('JUDr. Petr Dvořák')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'K vrácení peněz' }));
        expect(screen.getByText('JUDr. Petr Dvořák')).toBeTruthy();
    });
});
