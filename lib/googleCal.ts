import { collectDeadlines, type CaseDeadline } from './caseFile';
import type { LegalCase } from './cases';
import { computeAbsolute } from './lhuty';

// Google Kalendář: lhůty se zapisují do samostatného kalendáře „Kancelář – lhůty“, který aplikace sama vytvoří (nejužší oprávnění
// calendar.app.created: aplikace nevidí ostatní kalendáře). Přihlášení se ukládá zašifrované šifrovacím heslem advokáta.
export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
export const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
export const CALENDAR_NAME = 'Kancelář – lhůty';
export const GOOGLE_CALLBACK_PATH = '/kancelar/google-pripojeni';

export type Detail = 'minimal' | 'vec' | 'plne';
export const DETAIL_LABELS: Record<Detail, string> = { minimal: 'Jen název lhůty (nejbezpečnější)', vec: 'Název lhůty a název věci', plne: 'Název lhůty, věc, klient a vysvětlení výpočtu' };
export type GoogleOptions = { detail: Detail; internal: boolean };
export type GoogleTokens = { access_token: string; refresh_token?: string; expires_at: number };

export const googleAuthorizeUrl = (p: { clientId: string; redirectUri: string; challenge: string; state: string }) =>
    `${GOOGLE_AUTH}?${new URLSearchParams({ client_id: p.clientId, redirect_uri: p.redirectUri, response_type: 'code', scope: GOOGLE_SCOPE, access_type: 'offline', prompt: 'consent', code_challenge: p.challenge, code_challenge_method: 'S256', state: p.state })}`;

export type Desired = { key: string; kind: 'main' | 'internal'; date: string; summary: string; description: string };

const addDay = (iso: string) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + 1)).toISOString().slice(0, 10);
const prev = (iso: string) => computeAbsolute(iso).internal;

// Které události v kalendáři mají být: každá neukončená a ještě neprošlá lhůta, volitelně i interní termín (poslední pracovní den před koncem)
export function desiredEvents(cases: LegalCase[], customs: CaseDeadline[], opt: GoogleOptions, today: string, origin: string): Desired[] {
    const out: Desired[] = [];
    for (const c of cases) {
        if (c.status === 'done') continue;
        for (const d of collectDeadlines(c, customs.filter((x) => x.case_id === c.id))) {
            if (d.done || d.iso < today) continue;
            const caseCustom = d.customId ? customs.find((x) => x.id === d.customId) : undefined;
            const key = `${c.id}:${d.key}`;
            const link = `${origin}/kancelar/veci/${c.id}`;
            const where = opt.detail === 'minimal' ? '' : ` – ${c.title}`;
            const extra = opt.detail === 'plne' ? `${c.client_name ? `Klient: ${c.client_name}\n` : ''}${caseCustom?.basis ? `${caseCustom.basis}\n` : ''}` : '';
            const description = `${extra}Detail ve věci: ${link}\nKonec lhůty je třeba ověřit v dokumentu. Kalendář je jen pomůcka.`;
            out.push({ key, kind: 'main', date: d.iso, summary: `LHŮTA: ${d.title}${where}`.slice(0, 200), description });
            if (opt.internal) {
                const internal = caseCustom?.internal_date || prev(d.iso);
                if (internal >= today && internal < d.iso) out.push({ key, kind: 'internal', date: internal, summary: `Podat nejpozději: ${d.title}${where}`.slice(0, 200), description });
            }
        }
    }
    return out;
}

const REM = (nDays: number) => nDays * 1440 - 540; // připomínka v 9:00, n dnů před celodenní událostí
export function eventBody(d: Desired, key: string) {
    const main = d.kind === 'main';
    return {
        summary: d.summary, description: d.description, start: { date: d.date }, end: { date: addDay(d.date) }, transparency: 'transparent', colorId: main ? '11' : '6',
        reminders: { useDefault: false, overrides: main ? [{ method: 'popup', minutes: REM(7) }, { method: 'popup', minutes: REM(3) }, { method: 'popup', minutes: REM(1) }, { method: 'email', minutes: REM(1) }] : [{ method: 'popup', minutes: REM(1) }] },
        extendedProperties: { private: { kancelar: '1', key: key.slice(0, 120), kind: d.kind } },
    };
}

// Jednoduchý otisk události, aby se neměnily události, které se nezměnily
export function hashOf(d: Desired): string {
    const s = `${d.kind}|${d.date}|${d.summary}|${d.description}`;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return `${h >>> 0}`;
}

export type Mapped = { key: string; kind: 'main' | 'internal'; event_id: string; hash: string };
export type Plan = { insert: Desired[]; patch: { d: Desired; m: Mapped }[]; remove: Mapped[]; same: number };
export function planSync(desired: Desired[], mapped: Mapped[]): Plan {
    const id = (k: string, kind: string) => `${k}|${kind}`;
    const have = new Map(mapped.map((m) => [id(m.key, m.kind), m]));
    const want = new Set(desired.map((d) => id(d.key, d.kind)));
    const plan: Plan = { insert: [], patch: [], remove: [], same: 0 };
    for (const d of desired) {
        const m = have.get(id(d.key, d.kind));
        if (!m) plan.insert.push(d); else if (m.hash !== hashOf(d)) plan.patch.push({ d, m }); else plan.same += 1;
    }
    for (const m of mapped) if (!want.has(id(m.key, m.kind))) plan.remove.push(m);
    return plan;
}
