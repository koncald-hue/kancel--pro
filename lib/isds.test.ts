import { describe, expect, it } from 'vitest';
import { isNewMessage, statusTone, STATUS_LABELS, isDeleted, firstCookie, decodeMessageText, cookieSafe, cookieValue, loginUrl, parseMkState, stateUrl, createRequest, downloadRequest, findRequest, isUndelivered, listRequest, parseCreated, parseDownload, parseFind, parseList, statusOf } from './isds';

// Ukázkové odpovědi jsou sestavené podle dokumentace ISDS, ne z ostrého provozu.
const LIST = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><p:GetListOfReceivedMessagesResponse xmlns:p="http://isds.czechpoint.cz/v20"><p:dmRecords><p:dmRecord><p:dmID>123</p:dmID><p:dbIDSender>abc1234</p:dbIDSender><p:dmSender>Městský soud &amp; spol.</p:dmSender><p:dmRecipient>JUDr. Novák</p:dmRecipient><p:dmAnnotation>Usnesení</p:dmAnnotation><p:dmMessageStatus>4</p:dmMessageStatus><p:dmAttachmentSize>12</p:dmAttachmentSize><p:dmDeliveryTime>2026-11-10T10:00:00</p:dmDeliveryTime></p:dmRecord><p:dmRecord><p:dmID>124</p:dmID><p:dmSender>FÚ</p:dmSender><p:dmMessageStatus>7</p:dmMessageStatus></p:dmRecord></p:dmRecords><p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode><p:dmStatusMessage>OK</p:dmStatusMessage></p:dmStatus></p:GetListOfReceivedMessagesResponse></s:Body></s:Envelope>`;
const DOWNLOAD = `<s:Envelope><s:Body><p:MessageDownloadResponse xmlns:p="http://isds.czechpoint.cz/v20"><p:dmReturnedMessage><p:dmDm><p:dmID>123</p:dmID><p:dmSender>Soud</p:dmSender><p:dmAnnotation>Usnesení</p:dmAnnotation><p:dmFiles><p:dmFile dmMimeType="application/pdf" dmFileMetaType="main" dmFileDescr="usneseni.pdf"><p:dmEncodedContent>SGVsbG8=
</p:dmEncodedContent></p:dmFile></p:dmFiles></p:dmDm></p:dmReturnedMessage><p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus></p:MessageDownloadResponse></s:Body></s:Envelope>`;

describe('ISDS', () => {
    it('parses a message list and flags undelivered messages', () => {
        const l = parseList(LIST);
        expect(l).toHaveLength(2);
        expect(l[0]).toMatchObject({ id: '123', sender: 'Městský soud & spol.', status: '4', undelivered: true, attachmentSize: 12 });
        expect(l[1].undelivered).toBe(false);
        expect(statusOf(LIST)).toEqual({ code: '0000', message: 'OK' });
        expect(isUndelivered('6')).toBe(false);
        expect(isUndelivered('7')).toBe(false);
        expect(isDeleted('9')).toBe(true);
        expect(isDeleted('7')).toBe(false);
        expect(STATUS_LABELS['7']).toBe('přečtena');
    });
    it('parses a downloaded message with attachments', () => {
        const d = parseDownload(DOWNLOAD);
        expect(d?.files).toEqual([{ name: 'usneseni.pdf', mime: 'application/pdf', base64: 'SGVsbG8=', main: true }]);
        expect(parseDownload('<x/>')).toBeNull();
    });
    it('rejects attachment content that is not base64', () => {
        expect(parseDownload(DOWNLOAD.replace('SGVsbG8=', '<b>x</b>'))?.files ?? []).toEqual([]);
    });
    it('builds escaped requests', () => {
        expect(downloadRequest('1"2')).toContain('1&quot;2');
        expect(listRequest({ received: true, limit: 500 })).toContain('<p:dmLimit>100</p:dmLimit>');
        expect(listRequest({ received: true }, 'Recieved')).toContain('GetListOfRecievedMessages');
        expect(listRequest({ received: false })).toContain('GetListOfSentMessages');
        const c = createRequest({ recipient: 'abc1234', annotation: 'A & B', files: [{ name: 'a<b>.pdf', mime: 'application/pdf', base64: 'AAAA', main: true }] });
        expect(c).toContain('A &amp; B');
        expect(c).toContain('dmFileDescr="a&lt;b&gt;.pdf"');
        expect(c).toContain('dmFileMetaType="main"');
        expect(findRequest({ ic: '27082440' })).toContain('<p:ic>27082440</p:ic>');
    });
    it('reads search and send results', () => {
        const f = parseFind('<r><p:dbOwnerInfo><p:dbID>xyz9999</p:dbID><p:dbType>PO</p:dbType><p:ic>27082440</p:ic><p:firmName>Alza.cz a.s.</p:firmName><p:adCity>Praha</p:adCity></p:dbOwnerInfo></r>');
        expect(f).toEqual([{ id: 'xyz9999', name: 'Alza.cz a.s.', ic: '27082440', city: 'Praha', type: 'PO' }]);
        expect(parseCreated('<r><p:dmID>555</p:dmID><p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus></r>')).toEqual({ id: '555', status: { code: '0000', message: '' } });
    });
    it('reads cookies from Set-Cookie headers', () => {
        expect(cookieValue(['S-COOKIE=abc123XYZ==; Path=/; Secure', 'OTHER=1'], 'S-COOKIE')).toBe('abc123XYZ==');
        expect(cookieValue(['IPCZ-X-COOKIE=zzz.yyy-1; Path=/'], 'IPCZ-X-COOKIE')).toBe('zzz.yyy-1');
        expect(cookieValue(['X=1'], 'S-COOKIE')).toBeNull();
        expect(cookieSafe('abc123XYZ==')).toBe(true);
        expect(cookieSafe('a b; evil=1')).toBe(false);
    });
    it('maps the mobile key confirmation state', () => {
        expect(parseMkState('"2"')).toBe('confirmed');
        expect(parseMkState('1')).toBe('waiting');
        expect(parseMkState('3')).toBe('expired');
        expect(parseMkState('-1')).toBe('error');
        expect(parseMkState('<html>')).toBe('error');
    });
    it('builds environment URLs', () => {
        expect(loginUrl('test')).toContain('https://www.czebox.cz/as/processLogin?type=mep-ws&applicationName=');
        expect(stateUrl('prod')).toBe('https://www.mojedatovaschranka.cz/as/mepWsStateUpdate');
    });
    it('accepts real-world cookie characters and rejects separators', () => {
        expect(cookieSafe('abc:def|ghi!jkl$mno')).toBe(true);
        expect(cookieSafe('a'.repeat(1500))).toBe(true);
        expect(cookieSafe('abc def12345')).toBe(false);
        expect(cookieSafe('abcdef12;x=1')).toBe(false);
        expect(cookieSafe('abc"defgh')).toBe(false);
    });
    it('decodes the ISDS message header', () => {
        expect(decodeMessageText('=?UTF-8?B?Q2h5YmEgcMWZaWhsw6HFoWVuw60sIHpub3Z1IHphZGVqdGUgw7pkYWplLg==?=')).toBe('Chyba přihlášení, znovu zadejte údaje.');
        expect(decodeMessageText(null)).toBe('');
    });
    it('finds the first-step cookie under either name without confusing similar names', () => {
        expect(firstCookie(['IPCZ-S-COOKIE=abcdefgh1; Path=/'], ['IPCZ-S-COOKIE', 'S-COOKIE'])).toEqual({ name: 'IPCZ-S-COOKIE', value: 'abcdefgh1' });
        expect(firstCookie(['S-COOKIE=zzzzzzzz2; Path=/'], ['IPCZ-S-COOKIE', 'S-COOKIE'])).toEqual({ name: 'S-COOKIE', value: 'zzzzzzzz2' });
        expect(firstCookie(['IPCZ-X-COOKIE=x'], ['S-COOKIE'])).toBeNull();
    });
    it('counts only delivered but unread messages as new and colours every known status', () => {
        expect(['4', '5', '6', '7', '9'].map(isNewMessage)).toEqual([true, true, true, false, false]);
        for (const k of Object.keys(STATUS_LABELS)) expect(statusTone(k)).not.toContain('slate-100');
    });
});
