import { describe, expect, it } from 'vitest';
import { createRequest, downloadRequest, findRequest, isUndelivered, listRequest, parseCreated, parseDownload, parseFind, parseList, statusOf } from './isds';

// Ukázkové odpovědi jsou sestavené podle dokumentace ISDS, ne z ostrého provozu.
const LIST = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><p:GetListOfReceivedMessagesResponse xmlns:p="http://isds.czechpoint.cz/v20"><p:dmRecords><p:dmRecord><p:dmID>123</p:dmID><p:dbIDSender>abc1234</p:dbIDSender><p:dmSender>Městský soud &amp; spol.</p:dmSender><p:dmRecipient>JUDr. Novák</p:dmRecipient><p:dmAnnotation>Usnesení</p:dmAnnotation><p:dmMessageStatus>3</p:dmMessageStatus><p:dmAttachmentSize>12</p:dmAttachmentSize><p:dmDeliveryTime>2026-11-10T10:00:00</p:dmDeliveryTime></p:dmRecord><p:dmRecord><p:dmID>124</p:dmID><p:dmSender>FÚ</p:dmSender><p:dmMessageStatus>5</p:dmMessageStatus></p:dmRecord></p:dmRecords><p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode><p:dmStatusMessage>OK</p:dmStatusMessage></p:dmStatus></p:GetListOfReceivedMessagesResponse></s:Body></s:Envelope>`;
const DOWNLOAD = `<s:Envelope><s:Body><p:MessageDownloadResponse xmlns:p="http://isds.czechpoint.cz/v20"><p:dmReturnedMessage><p:dmDm><p:dmID>123</p:dmID><p:dmSender>Soud</p:dmSender><p:dmAnnotation>Usnesení</p:dmAnnotation><p:dmFiles><p:dmFile dmMimeType="application/pdf" dmFileMetaType="main" dmFileDescr="usneseni.pdf"><p:dmEncodedContent>SGVsbG8=
</p:dmEncodedContent></p:dmFile></p:dmFiles></p:dmDm></p:dmReturnedMessage><p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus></p:MessageDownloadResponse></s:Body></s:Envelope>`;

describe('ISDS', () => {
    it('parses a message list and flags undelivered messages', () => {
        const l = parseList(LIST);
        expect(l).toHaveLength(2);
        expect(l[0]).toMatchObject({ id: '123', sender: 'Městský soud & spol.', status: '3', undelivered: true, attachmentSize: 12 });
        expect(l[1].undelivered).toBe(false);
        expect(statusOf(LIST)).toEqual({ code: '0000', message: 'OK' });
        expect(isUndelivered('4')).toBe(false);
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
});
