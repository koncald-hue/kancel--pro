import type { Desired } from './googleCal';

// Kalendář Microsoft 365 / Outlook: lhůty se zapisují do samostatného kalendáře „Kancelář – lhůty“, který aplikace sama vytvoří.
// Na rozdíl od Googlu Microsoft neumí omezit oprávnění jen na kalendář vytvořený aplikací: souhlas (Calendars.ReadWrite) se týká všech
// kalendářů účtu. Aplikace proto sahá výhradně na ten svůj (podle jeho ID) a ostatní nečte.
export const MS_AUTHORITY = 'https://login.microsoftonline.com';
export const MS_GRAPH = 'https://graph.microsoft.com/v1.0';
export const MS_SCOPE = 'Calendars.ReadWrite offline_access';
export const MS_CALLBACK_PATH = '/kancelar/microsoft-pripojeni';
export const MS_CALENDAR_NAME = 'Kancelář – lhůty';
export const MS_EVENT_KEYS = ['subject', 'body', 'start', 'end', 'isAllDay', 'showAs', 'isReminderOn', 'reminderMinutesBeforeStart', 'categories', 'location'];
export const MS_ID = /^[A-Za-z0-9_=-]{5,400}$/;

export const msAuthorizeUrl = (p: { tenant: string; clientId: string; redirectUri: string; challenge: string; state: string }) =>
    `${MS_AUTHORITY}/${encodeURIComponent(p.tenant)}/oauth2/v2.0/authorize?${new URLSearchParams({ client_id: p.clientId, response_type: 'code', redirect_uri: p.redirectUri, response_mode: 'query', scope: MS_SCOPE, code_challenge: p.challenge, code_challenge_method: 'S256', state: p.state, prompt: 'select_account' })}`;

const addDay = (iso: string) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + 1)).toISOString().slice(0, 10);
const REM = (days: number) => days * 1440 - 540; // připomínka v 9:00, n dnů před celodenní událostí (Outlook umí jedinou připomínku)

// Událost pro Microsoft Graph. Celodenní události jsou ve Graphu půlnoc–půlnoc v časovém pásmu, časové události se posílají v UTC.
export function msEventBody(d: Desired) {
    const timed = !!d.startAt && !!d.endAt;
    const reminder = timed ? 30 : d.lowKey ? 480 : d.kind === 'main' ? REM(3) : REM(1);
    return {
        subject: d.summary,
        body: { contentType: 'text', content: d.description },
        start: timed ? { dateTime: d.startAt!.slice(0, 19), timeZone: 'UTC' } : { dateTime: `${d.date}T00:00:00`, timeZone: 'Europe/Prague' },
        end: timed ? { dateTime: d.endAt!.slice(0, 19), timeZone: 'UTC' } : { dateTime: `${addDay(d.date)}T00:00:00`, timeZone: 'Europe/Prague' },
        isAllDay: !timed,
        showAs: timed ? 'busy' : 'free',
        isReminderOn: true,
        reminderMinutesBeforeStart: reminder,
        categories: ['Kancelář'],
        ...(d.location ? { location: { displayName: d.location.slice(0, 200) } } : {}),
    };
}
