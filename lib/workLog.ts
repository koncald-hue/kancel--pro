// Automatický návrh výkazu práce: z toho, co advokát v aplikaci udělal (přečetl datovku, napsal e-mail, připravil dokument…),
// složí pro každou věc a den návrh času a popisu. Nic se nezapisuje samo, advokát návrh potvrdí nebo upraví.
export type ActivityKind = 'email_read' | 'email_sent' | 'datovka_read' | 'document_created' | 'file_opened' | 'file_added' | 'entry_added' | 'deadline_added' | 'deadline_done' | 'client_message' | 'signature_request';
export type Activity = { id: string; case_id: string | null; kind: ActivityKind; label: string; words: number; at: string; time_entry_id: string | null; dismissed: boolean };

// Odhad času jednoho úkonu v minutách a jeho popis ve výkazu
export const KIND: Record<ActivityKind, { label: string; base: number; perWords?: number; cap: number }> = {
    datovka_read: { label: 'studium datové zprávy', base: 6, cap: 30 },
    email_read: { label: 'studium e-mailu', base: 3, cap: 10 },
    email_sent: { label: 'korespondence e-mailem', base: 5, perWords: 60, cap: 45 },
    document_created: { label: 'příprava dokumentu', base: 20, cap: 60 },
    file_opened: { label: 'studium dokumentu ve spisu', base: 5, cap: 15 },
    file_added: { label: 'založení dokumentu do spisu', base: 2, cap: 5 },
    entry_added: { label: 'záznam do spisu', base: 3, perWords: 40, cap: 20 },
    deadline_added: { label: 'evidence lhůty', base: 3, cap: 5 },
    deadline_done: { label: 'vyřízení úkolu', base: 5, cap: 15 },
    client_message: { label: 'komunikace s klientem', base: 4, perWords: 50, cap: 25 },
    signature_request: { label: 'příprava dokumentu k podpisu', base: 8, cap: 15 },
};
export function estimate(a: Pick<Activity, 'kind' | 'words'>): number {
    const k = KIND[a.kind]; if (!k) return 0;
    return Math.min(k.cap, k.base + (k.perWords ? Math.floor(Math.max(0, a.words) / k.perWords) : 0));
}

export const pragueDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });
export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export type Suggestion = { key: string; caseId: string | null; day: string; minutes: number; rawMinutes: number; already: number; description: string; activityIds: string[]; from: string; to: string };

// Jedna věc, jeden den: úkony blízko po sobě (do `gap` minut) tvoří jedno sezení; sezení trvá aspoň součet odhadů
export function suggest(acts: Activity[], logged: { case_id: string | null; entry_date: string; minutes: number }[], opt: { unit: number; gap?: number }): Suggestion[] {
    const gap = (opt.gap ?? 15) * 60_000;
    const open = acts.filter((a) => !a.time_entry_id && !a.dismissed && KIND[a.kind]);
    const groups = new Map<string, Activity[]>();
    for (const a of open) { const k = `${a.case_id ?? ''}|${pragueDay(a.at)}`; groups.set(k, [...(groups.get(k) ?? []), a]); }
    const out: Suggestion[] = [];
    for (const [key, list] of groups) {
        const [caseKey, day] = key.split('|'); const caseId = caseKey || null;
        const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
        let total = 0; let start = 0; let end = 0; let sum = 0;
        for (const a of sorted) {
            const t = new Date(a.at).getTime(); const est = estimate(a) * 60_000;
            if (start && t - end > gap) { total += Math.max(sum, end - start); start = 0; }
            if (!start) { start = t; end = t + est; sum = est; } else { end = Math.max(end, t + est); sum += est; }
        }
        if (start) total += Math.max(sum, end - start);
        const raw = Math.round(total / 60_000);
        const already = logged.filter((e) => (e.case_id ?? null) === caseId && e.entry_date === day).reduce((s, e) => s + e.minutes, 0);
        const rest = raw - already;
        if (rest <= 0) continue;
        const minutes = Math.max(opt.unit, Math.ceil(rest / opt.unit) * opt.unit);
        out.push({ key, caseId, day, minutes, rawMinutes: raw, already, description: describe(sorted), activityIds: sorted.map((a) => a.id), from: sorted[0].at, to: sorted[sorted.length - 1].at });
    }
    return out.sort((a, b) => b.day.localeCompare(a.day) || b.minutes - a.minutes);
}

// Popis úkonů: „Studium datové zprávy, korespondence e-mailem (2×), příprava dokumentu: Plná moc“
export function describe(acts: Pick<Activity, 'kind' | 'label'>[]): string {
    const order: ActivityKind[] = []; const count = new Map<ActivityKind, number>(); const labels = new Map<ActivityKind, string[]>();
    for (const a of acts) {
        if (!count.has(a.kind)) order.push(a.kind);
        count.set(a.kind, (count.get(a.kind) ?? 0) + 1);
        if (a.label && (a.kind === 'document_created' || a.kind === 'signature_request')) labels.set(a.kind, [...new Set([...(labels.get(a.kind) ?? []), a.label])]);
    }
    const parts = order.map((k) => { const n = count.get(k) ?? 1; const l = labels.get(k); return `${KIND[k].label}${l?.length ? `: ${l.slice(0, 2).join(', ')}` : ''}${n > 1 && !l?.length ? ` (${n}×)` : ''}`; });
    const s = parts.join(', ');
    return (s.charAt(0).toUpperCase() + s.slice(1)).slice(0, 300);
}

export const fmtMinutes = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
