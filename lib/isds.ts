// Datové schránky (ISDS): SOAP klient. Přihlašovací údaje se na server posílají jen pro jedno volání a neukládají se.
// POZOR: sestavení a čtení zpráv vychází z veřejné dokumentace ISDS; před ostrým použitím je nutné ověřit na testovacím prostředí.
export type IsdsEnv = 'test' | 'prod';
export const ISDS_BASE: Record<IsdsEnv, string> = { test: 'https://ws1.czebox.cz/DS', prod: 'https://ws1.mojedatovaschranka.cz/DS' };
const NS = 'http://isds.czechpoint.cz/v20';

export type IsdsService = 'dz' | 'dx' | 'df';
export type Credentials = { login: string; password: string };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export const envelope = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`;

export type Query = { received: boolean; from?: string; to?: string; offset?: number; limit?: number };
export function listRequest(q: Query, spelling: 'Received' | 'Recieved' = 'Received'): string {
    const op = q.received ? `GetListOf${spelling}Messages` : 'GetListOfSentMessages';
    const parts = [q.from ? `<p:dmFromTime>${esc(q.from)}</p:dmFromTime>` : '', q.to ? `<p:dmToTime>${esc(q.to)}</p:dmToTime>` : '', `<p:dmStatusFilter>-1</p:dmStatusFilter>`, `<p:dmOffset>${q.offset ?? 1}</p:dmOffset>`, `<p:dmLimit>${Math.min(q.limit ?? 50, 100)}</p:dmLimit>`].join('');
    return envelope(`<p:${op} xmlns:p="${NS}">${parts}</p:${op}>`);
}
export const downloadRequest = (dmId: string) => envelope(`<p:MessageDownload xmlns:p="${NS}"><p:dmID>${esc(dmId)}</p:dmID></p:MessageDownload>`);
export const findRequest = (f: { ic?: string; name?: string }) => envelope(`<p:FindDataBox xmlns:p="${NS}"><p:dbOwnerInfo>${f.ic ? `<p:ic>${esc(f.ic)}</p:ic>` : ''}${f.name ? `<p:firmName>${esc(f.name)}</p:firmName>` : ''}</p:dbOwnerInfo></p:FindDataBox>`);

export type OutFile = { name: string; mime: string; base64: string; main: boolean };
export type OutMessage = { recipient: string; annotation: string; toHands?: string; senderRef?: string; files: OutFile[] };
export function createRequest(m: OutMessage): string {
    const files = m.files.map((f, i) => `<p:dmFile dmMimeType="${esc(f.mime || 'application/octet-stream')}" dmFileMetaType="${f.main && i === 0 ? 'main' : 'enclosure'}" dmFileDescr="${esc(f.name)}"><p:dmEncodedContent>${f.base64}</p:dmEncodedContent></p:dmFile>`).join('');
    return envelope(`<p:CreateMessage xmlns:p="${NS}"><p:dmEnvelope><p:dbIDRecipient>${esc(m.recipient)}</p:dbIDRecipient>${m.toHands ? `<p:dmToHands>${esc(m.toHands)}</p:dmToHands>` : ''}<p:dmAnnotation>${esc(m.annotation)}</p:dmAnnotation>${m.senderRef ? `<p:dmSenderRefNumber>${esc(m.senderRef)}</p:dmSenderRefNumber>` : ''}<p:dmPersonalDelivery>false</p:dmPersonalDelivery><p:dmAllowSubstDelivery>true</p:dmAllowSubstDelivery></p:dmEnvelope><p:dmFiles>${files}</p:dmFiles></p:CreateMessage>`);
}

const tag = (b: string, name: string) => unesc(b.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${name}>`))?.[1]?.trim() ?? '');

export type Status = { code: string; message: string };
export const statusOf = (xml: string): Status => ({ code: tag(xml, 'dmStatusCode') || tag(xml, 'dbStatusCode'), message: tag(xml, 'dmStatusMessage') || tag(xml, 'dbStatusMessage') });
export const isOk = (s: Status) => s.code === '0000';
export const isFault = (xml: string) => /<(?:\w+:)?Fault[\s>]/.test(xml);

// Stav zprávy podle ISDS: 1 podána, 2 s časovým razítkem, 3 dodána (ještě nepřevzatá), 4 doručena přihlášením, 5 přečtena, 6 nedoručitelná, 7 smazána, 8 v úložišti
export const STATUS_LABELS: Record<string, string> = { '1': 'podána', '2': 'podána s časovým razítkem', '3': 'dodána (zatím nepřevzata)', '4': 'doručena', '5': 'přečtena', '6': 'nedoručitelná', '7': 'smazána', '8': 'v úložišti' };
export const isUndelivered = (status: string) => status === '1' || status === '2' || status === '3';

export type Record_ = { id: string; sender: string; senderBox: string; recipient: string; recipientBox: string; annotation: string; status: string; delivered: string; accepted: string; attachmentSize: number; undelivered: boolean };
export function parseList(xml: string): Record_[] {
    const out: Record_[] = [];
    for (const m of xml.matchAll(/<(?:\w+:)?dmRecord(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?dmRecord>/g)) {
        const b = m[1];
        const status = tag(b, 'dmMessageStatus');
        out.push({ id: tag(b, 'dmID'), sender: tag(b, 'dmSender'), senderBox: tag(b, 'dbIDSender'), recipient: tag(b, 'dmRecipient'), recipientBox: tag(b, 'dbIDRecipient'), annotation: tag(b, 'dmAnnotation'), status, delivered: tag(b, 'dmDeliveryTime'), accepted: tag(b, 'dmAcceptanceTime'), attachmentSize: Number(tag(b, 'dmAttachmentSize')) || 0, undelivered: isUndelivered(status) });
    }
    return out.filter((r) => r.id);
}

export type DownloadedFile = { name: string; mime: string; base64: string; main: boolean };
export type Downloaded = { id: string; sender: string; annotation: string; files: DownloadedFile[] };
export function parseDownload(xml: string): Downloaded | null {
    const env = xml.match(/<(?:\w+:)?dmReturnedMessage(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?dmReturnedMessage>/)?.[1];
    if (!env) return null;
    const files: DownloadedFile[] = [];
    for (const f of env.matchAll(/<(?:\w+:)?dmFile((?:\s[^>]*)?)>([\s\S]*?)<\/(?:\w+:)?dmFile>/g)) {
        const attrs = f[1];
        const content = f[2].match(/<(?:\w+:)?dmEncodedContent(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?dmEncodedContent>/)?.[1]?.replace(/\s+/g, '') ?? '';
        if (!/^[A-Za-z0-9+/=]*$/.test(content)) continue;
        const attr = (n: string) => unesc(attrs.match(new RegExp(`${n}="([^"]*)"`))?.[1] ?? '');
        files.push({ name: attr('dmFileDescr') || 'priloha', mime: attr('dmMimeType'), base64: content, main: attr('dmFileMetaType') === 'main' });
    }
    return { id: tag(env, 'dmID'), sender: tag(env, 'dmSender'), annotation: tag(env, 'dmAnnotation'), files };
}

export type BoxHit = { id: string; name: string; ic: string; city: string; type: string };
export function parseFind(xml: string): BoxHit[] {
    const out: BoxHit[] = [];
    for (const m of xml.matchAll(/<(?:\w+:)?dbOwnerInfo(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?dbOwnerInfo>/g)) {
        const b = m[1];
        const name = tag(b, 'firmName') || [tag(b, 'pnFirstName'), tag(b, 'pnLastName')].filter(Boolean).join(' ');
        if (tag(b, 'dbID')) out.push({ id: tag(b, 'dbID'), name, ic: tag(b, 'ic'), city: tag(b, 'adCity'), type: tag(b, 'dbType') });
    }
    return out;
}

export const parseCreated = (xml: string): { id: string; status: Status } => ({ id: tag(xml, 'dmID'), status: statusOf(xml) });

// ---------- Přihlášení Mobilním klíčem (dokument ISDS „Podpora autentizace Mobilním klíčem“ v1.2) ----------
// 1) POST processLogin s Basic (jméno : komunikační kód) -> S-COOKIE, uživatel potvrdí push v aplikaci Mobilní klíč
// 2) GET mepWsStateUpdate se S-COOKIE, dokud odpověď není „2“
// 3) znovu POST processLogin s Basic + S-COOKIE -> IPCZ-X-COOKIE (platí 30 minut) pro volání webových služeb
export const HOSTS: Record<IsdsEnv, string> = { test: 'www.czebox.cz', prod: 'www.mojedatovaschranka.cz' };
export const APP_NAME = 'Kancelář';
export const USER_AGENT = 'Kancelar/1.0';
export const SESSION_MINUTES = 25; // cookie platí 30 minut, obnovujeme dřív

export const loginUrl = (env: IsdsEnv) => `https://${HOSTS[env]}/as/processLogin?type=mep-ws&applicationName=${encodeURIComponent(APP_NAME)}&uri=${encodeURIComponent(`https://${HOSTS[env]}/apps/DS/dz`)}`;
export const stateUrl = (env: IsdsEnv) => `https://${HOSTS[env]}/as/mepWsStateUpdate`;
export const logoutUrl = (env: IsdsEnv) => `https://${HOSTS[env]}/as/processLogout?uri=${encodeURIComponent(`https://${HOSTS[env]}/apps/DS/dz`)}`;
export const appsUrl = (env: IsdsEnv, service: IsdsService) => `https://${HOSTS[env]}/apps/DS/${service}`;

export const basicHeader = (c: Credentials) => `Basic ${Buffer.from(`${c.login}:${c.password}`).toString('base64')}`;

// Cookie z prvního kroku se ve skutečnosti jmenuje IPCZ-S-COOKIE (dokument uvádí S-COOKIE), proto se přijímají oba názvy
export const S_COOKIE_NAMES = ['IPCZ-S-COOKIE', 'S-COOKIE'] as const;
export function firstCookie(setCookies: string[], names: readonly string[]): { name: string; value: string } | null {
    for (const name of names) { const value = cookieValue(setCookies, name); if (value) return { name, value }; }
    return null;
}

// Hodnota cookie podle jména z hlaviček Set-Cookie
export function cookieValue(setCookies: string[], name: string): string | null {
    for (const line of setCookies) {
        const m = line.match(new RegExp(`(?:^|\\s)${name.replace(/[-]/g, '\\-')}=([^;]+)`));
        if (m) return m[1];
    }
    return null;
}
// Hodnota cookie smí obsahovat jen znaky povolené v RFC 6265 (žádné mezery, uvozovky, čárky, středníky ani zpětná lomítka)
export const cookieSafe = (v: string) => /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]{8,4000}$/.test(v);

// Text z hlavičky X-Response-message-text (RFC 2047, metoda B, může být rozdělený do bloků)
export function decodeMessageText(header: string | null): string {
    if (!header) return '';
    const parts = [...header.matchAll(/=\?UTF-8\?B\?([^?]*)\?=/gi)].map((m) => Buffer.from(m[1], 'base64').toString('utf8'));
    return parts.length ? parts.join('') : header.slice(0, 200);
}

// Stav potvrzení v mobilní aplikaci: 1 čeká se, 2 potvrzeno, 3 vypršelo
export type MkState = 'waiting' | 'confirmed' | 'expired' | 'error';
export const parseMkState = (body: string): MkState => { const t = body.replace(/["\s]/g, ''); return t === '2' ? 'confirmed' : t === '1' ? 'waiting' : t === '3' ? 'expired' : 'error'; };

export type Auth = { type: 'basic'; cred: Credentials } | { type: 'cookie'; env: IsdsEnv; value: string };

// Odeslání jednoho volání; vrací surové XML odpovědi (nebo chybu spojení). Heslo ani cookie se nikam nezapisují.
export async function callIsds(env: IsdsEnv, service: IsdsService, body: string, auth: Credentials | Auth): Promise<{ ok: true; xml: string } | { ok: false; kind: 'auth' | 'network' | 'http'; status: number }> {
    const a: Auth = 'type' in auth ? auth : { type: 'basic', cred: auth };
    try {
        const headers: Record<string, string> = { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""', 'User-Agent': USER_AGENT };
        let url = `${ISDS_BASE[env]}/${service}`;
        if (a.type === 'cookie') { url = appsUrl(env, service); headers.Cookie = `IPCZ-X-COOKIE=${a.value}`; }
        else if (a.cred.login && a.cred.password) headers.Authorization = basicHeader(a.cred);
        const res = await fetch(url, { method: 'POST', headers, body, cache: 'no-store', signal: AbortSignal.timeout(60_000) });
        if (res.status === 401 || res.status === 403) return { ok: false, kind: 'auth', status: res.status };
        const xml = await res.text();
        if (!res.ok && !isFault(xml)) return { ok: false, kind: 'http', status: res.status };
        return { ok: true, xml };
    } catch { return { ok: false, kind: 'network', status: 0 }; }
}
