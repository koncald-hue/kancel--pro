// Push upozornění na lhůty. Text upozornění je záměrně obecný (počty, žádné názvy věcí ani klientů), protože se zobrazí na zamčené obrazovce.
export type PushCounts = { overdue: number; today: number; soon: number };
export type PushMessage = { title: string; body: string; tag: string; url: string };

const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
const lhut = (n: number) => `${n} ${plural(n, 'lhůta', 'lhůty', 'lhůt')}`;

export function buildPushMessage(c: PushCounts, today: string): PushMessage | null {
    if (c.overdue + c.today + c.soon === 0) return null;
    const parts: string[] = [];
    if (c.overdue) parts.push(`po termínu: ${lhut(c.overdue)}`);
    if (c.today) parts.push(`dnes končí: ${lhut(c.today)}`);
    if (c.soon) parts.push(`do 3 dnů: ${lhut(c.soon)}`);
    const urgent = c.overdue + c.today > 0;
    return { title: urgent ? 'Kancelář: pozor na lhůty' : 'Kancelář: blíží se lhůty', body: `${parts.join(', ')}.`.replace(/^./, (m) => m.toUpperCase()), tag: `lhuty-${today}`, url: '/kancelar' };
}

export function countDeadlines(rows: { due_date: string }[], today: string, soonDays = 3): PushCounts {
    const end = new Date(Date.parse(`${today}T12:00:00Z`) + soonDays * 86_400_000).toISOString().slice(0, 10);
    const c: PushCounts = { overdue: 0, today: 0, soon: 0 };
    for (const r of rows) { if (r.due_date < today) c.overdue++; else if (r.due_date === today) c.today++; else if (r.due_date <= end) c.soon++; }
    return c;
}

// Kontrola odběru z prohlížeče: https adresa, klíče v rozumné délce
export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
export function parseSubscription(v: unknown): PushSub | null {
    const o = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
    if (!o || typeof o.endpoint !== 'string' || !/^https:\/\/[^\s]{8,990}$/.test(o.endpoint)) return null;
    const p = o.keys?.p256dh, a = o.keys?.auth;
    if (typeof p !== 'string' || typeof a !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(p) || !/^[A-Za-z0-9_-]{8,100}$/.test(a)) return null;
    return { endpoint: o.endpoint, keys: { p256dh: p, auth: a } };
}
