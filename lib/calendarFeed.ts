// Kalendář lhůt k odběru (iCal): celodenní události s upozorněními. Čisté funkce pro server i testy.
// type: lhůta (výchozí, celodenní s upozorněním týden předem), úkol (celodenní nebo v daný čas), událost (od–do)
export type FeedEvent = { uid: string; iso: string; title: string; caseId: string | null; caseTitle: string; type?: 'lhuta' | 'ukol' | 'udalost'; startUtc?: string; endUtc?: string; place?: string };
const utc = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '');

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Řádky iCal se lámou po 75 bajtech (UTF-8), nikdy uprostřed znaku
export function fold(line: string): string {
    const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
    const out: string[] = []; let cur = ''; let size = 0; let limit = 75;
    for (const ch of line) { const n = enc.encode(ch).length; if (size + n > limit) { out.push(cur); cur = ' '; size = 1; limit = 75; } cur += ch; size += n; }
    out.push(cur);
    return out.join('\r\n');
}
const nextDay = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

export function buildFeed(events: FeedEvent[], opt: { includeTitles: boolean; origin: string; name?: string; stamp?: Date }): string {
    const stamp = (opt.stamp ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kancelar//Lhuty//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(opt.name ?? 'Kancelář – lhůty')}`, 'X-WR-TIMEZONE:Europe/Prague', 'REFRESH-INTERVAL;VALUE=DURATION:PT4H', 'X-PUBLISHED-TTL:PT4H'];
    for (const e of events) {
        const type = e.type ?? 'lhuta';
        if (type !== 'lhuta') {
            // Úkoly a události: bez názvů věcí, pokud je odběratel nechce; název úkolu či události se uvádí vždy (zadal ho uživatel sám nebo kolega)
            const summary = `${type === 'ukol' ? 'Úkol: ' : ''}${e.title}${opt.includeTitles && e.caseTitle ? ` · ${e.caseTitle}` : ''}`;
            L.push('BEGIN:VEVENT', `UID:${e.uid}@kancelar`, `DTSTAMP:${stamp}`);
            if (e.startUtc && e.endUtc) L.push(`DTSTART:${utc(e.startUtc)}`, `DTEND:${utc(e.endUtc)}`, 'TRANSP:OPAQUE');
            else L.push(`DTSTART;VALUE=DATE:${e.iso.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(e.iso).replace(/-/g, '')}`, 'TRANSP:TRANSPARENT');
            L.push(`SUMMARY:${esc(summary)}`);
            if (e.place) L.push(`LOCATION:${esc(e.place)}`);
            L.push(`DESCRIPTION:${esc('Podrobnosti najdete v Kanceláři.')}`, `URL:${opt.origin}/kancelar/${type === 'ukol' ? 'ukoly' : 'kalendar'}`);
            L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.startUtc ? 'Za 30 minut' : 'Úkol na dnes')}`, e.startUtc ? 'TRIGGER:-PT30M' : 'TRIGGER:PT8H', 'END:VALARM', 'END:VEVENT');
            continue;
        }
        const summary = `Lhůta: ${e.title}${opt.includeTitles && e.caseTitle ? ` · ${e.caseTitle}` : ''}`;
        L.push('BEGIN:VEVENT', `UID:${e.uid}@kancelar`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${e.iso.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(e.iso).replace(/-/g, '')}`, 'TRANSP:TRANSPARENT', `SUMMARY:${esc(summary)}`);
        L.push(`DESCRIPTION:${esc(opt.includeTitles && e.caseTitle ? `Věc: ${e.caseTitle}. Podrobnosti najdete v Kanceláři.` : 'Podrobnosti najdete v Kanceláři.')}`);
        if (opt.includeTitles && e.caseId) L.push(`URL:${opt.origin}/kancelar/veci/${e.caseId}`);
        // Upozornění v 8:00: sedm dní předem, den předem a v den lhůty
        for (const [trigger, text] of [['-P6DT16H', 'Lhůta za týden'], ['-PT16H', 'Lhůta končí zítra'], ['PT8H', 'Lhůta končí dnes']] as const) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, 'END:VALARM');
        L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return `${L.map(fold).join('\r\n')}\r\n`;
}
