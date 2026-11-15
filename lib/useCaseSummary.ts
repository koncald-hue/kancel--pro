'use client';

import { useEffect, useState } from 'react';
import { collectDeadlines, loadAllDeadlines, type CaseDeadline } from './caseFile';
import { daysUntil, loadCases } from './cases';

export type CaseSummary = {
    openCount: number;
    // Za kolik dní končí nejbližší lhůta ze všech otevřených případů (null = žádná)
    nextDays: number | null;
    nextTitle: string;
    nextCaseId: string;
};

// Stručný přehled případů přihlášeného uživatele pro hlavičku a úvodní stránku.
// Když spis ještě není v databázi zapnutý, vrací null a nic se nezobrazí.
export function useCaseSummary(accountId: string | undefined, refreshKey = ''): CaseSummary | null {
    const [state, setState] = useState<{ key: string; summary: CaseSummary | null }>({ key: '', summary: null });
    const key = accountId ? `${accountId}:${refreshKey}` : '';

    useEffect(() => {
        if (!accountId) return;
        let cancelled = false;
        (async () => {
            try {
                const cases = await loadCases();
                let customs: CaseDeadline[] = [];
                try { customs = await loadAllDeadlines(); } catch { /* vlastní lhůty nemusí být zapnuté */ }
                const open = cases.filter((c) => c.status === 'open');
                const upcoming = open
                    .flatMap((c) => collectDeadlines(c, customs.filter((d) => d.case_id === c.id)).filter((d) => !d.done && daysUntil(d.date) >= 0).map((d) => ({ c, d })))
                    .sort((a, b) => a.d.date.getTime() - b.d.date.getTime())[0];
                if (!cancelled) setState({ key, summary: { openCount: open.length, nextDays: upcoming ? daysUntil(upcoming.d.date) : null, nextTitle: upcoming?.d.title ?? '', nextCaseId: upcoming?.c.id ?? '' } });
            } catch {
                if (!cancelled) setState({ key, summary: null });
            }
        })();
        return () => { cancelled = true; };
    }, [accountId, key]);

    return accountId && state.key === key ? state.summary : null;
}
