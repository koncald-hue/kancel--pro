import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaseExportPanel from './CaseExportPanel';

vi.mock('next/link', () => ({ default: ({ href, children, ...p }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...p}>{children}</a> }));
vi.mock('./useChannelKey', () => ({ useChannelKey: () => ({ key: null, hasEncrypted: false, locked: false }), useDecryptedNames: () => ({}) }));

afterEach(cleanup);

const base = { item: { id: 'c1', title: 'Spis', steps: [], offense_ids: [], deadline_ids: [], template_keys: [], created_at: '2026-01-01' } as never, bundle: { folders: [], files: [], entries: [], deadlines: [], contacts: [] }, deadlines: [], onClose: vi.fn(), fail: vi.fn() };

describe('CaseExportPanel tiers', () => {
    it('offers only the printout to free users, with an upgrade note', () => {
        render(<CaseExportPanel {...base} lawyer={false} />);
        expect(screen.queryByRole('button', { name: /ZIP/ })).toBeNull();
        expect(screen.getByRole('button', { name: /Tisk/ })).toBeTruthy();
        expect(screen.getByRole('link', { name: /Balíček pro advokáty/ }).getAttribute('href')).toBe('/');
    });

    it('offers the ZIP archive to lawyers', () => {
        render(<CaseExportPanel {...base} lawyer />);
        expect(screen.getByRole('button', { name: /ZIP/ })).toBeTruthy();
    });
});
