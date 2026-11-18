// Evidence úschov: kniha pohybů. Počítá zůstatek, hlídá výdej nad zůstatek a připravuje výpis. Kancelář peníze nedrží.
export type MoveKind = 'deposit' | 'payout' | 'correction_in' | 'correction_out';
export type Move = { id: string; kind: MoveKind; amount: number; moved_on: string; party: string; reference: string; note: string };
export type Escrow = { id: string; title: string; purpose: string; currency: 'CZK' | 'EUR'; bank_account: string; status: 'open' | 'closed'; opened_on: string; closed_on: string | null; client_id: string | null; case_id: string | null; note: string };

export const KIND_LABEL: Record<MoveKind, string> = { deposit: 'Příjem do úschovy', payout: 'Výdej z úschovy', correction_in: 'Oprava (příjem)', correction_out: 'Oprava (výdej)' };
export const isIn = (k: MoveKind) => k === 'deposit' || k === 'correction_in';
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const balanceOf = (moves: Pick<Move, 'kind' | 'amount'>[]) => round2(moves.reduce((s, m) => s + (isIn(m.kind) ? m.amount : -m.amount), 0));

export function checkMove(balance: number, kind: MoveKind, amount: number, movedOn: string, today: string): string | null {
    if (!Number.isFinite(amount) || amount <= 0) return 'Částka musí být větší než nula.';
    if (round2(amount) !== amount) return 'Částka může mít nejvýš dvě desetinná místa.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(movedOn)) return 'Zadejte datum pohybu.';
    if (movedOn > today) return 'Pohyb nemůže být v budoucnosti.';
    if (!isIn(kind) && amount > balance) return 'Výdej převyšuje zůstatek úschovy.';
    return null;
}

export const parseAmount = (s: string): number => Number(s.replace(/\s/g, '').replace(',', '.'));

export const daysOpen = (e: Pick<Escrow, 'opened_on' | 'closed_on'>, today: string): number => Math.max(0, Math.round((Date.parse(`${(e.closed_on ?? today)}T12:00:00Z`) - Date.parse(`${e.opened_on}T12:00:00Z`)) / 86400000));

// Úschova s nenulovým zůstatkem, která leží dlouho, si zaslouží pozornost (výchozí práh 90 dní)
export const isStale = (e: Escrow, balance: number, today: string, limit = 90) => e.status === 'open' && balance > 0 && daysOpen(e, today) > limit;

// Kontrola proti bance: zůstatek podle evidence a podle výpisu se mají shodovat
export const reconcile = (evidence: number, bank: number) => { const diff = round2(bank - evidence); return { diff, ok: diff === 0 }; };

export function movesCsv(e: Escrow, moves: Move[]): string {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    let run = 0;
    const rows = [...moves].sort((a, b) => a.moved_on.localeCompare(b.moved_on)).map((m) => { run = round2(run + (isIn(m.kind) ? m.amount : -m.amount)); return [m.moved_on, KIND_LABEL[m.kind], (isIn(m.kind) ? m.amount : -m.amount).toFixed(2).replace('.', ','), run.toFixed(2).replace('.', ','), q(m.party), q(m.reference), q(m.note)].join(';'); });
    return ['﻿' + `Úschova;${q(e.title)};Měna;${e.currency}`, 'Datum;Pohyb;Částka;Zůstatek;Strana;Odkaz;Poznámka', ...rows].join('\r\n');
}
