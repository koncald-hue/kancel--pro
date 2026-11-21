import { describe, expect, it } from 'vitest';
import { FILE_NO, hasBlocker, hasWarning, preflight, type PreflightInput } from './preflight';

const base: PreflightInput = { recipientId: 'abc1234', recipientName: 'Okresní soud Plzeň-město', annotation: 'Vyjádření k žalobě, sp. zn. 12 C 345/2026', files: [{ name: 'vyjadreni.pdf', size: 1000, type: 'application/pdf', signed: true }], caseRef: { title: 'Spor', reference: '12 C 345/2026', authority: 'Okresní soud Plzeň-město' }, deadlines: [], prod: false, today: '2026-11-17' };
const texts = (i: Partial<PreflightInput>) => preflight({ ...base, ...i });

describe('pre-send check', () => {
    it('passes a clean submission without errors or warnings', () => {
        const c = texts({});
        expect(hasBlocker(c)).toBe(false); expect(hasWarning(c)).toBe(false);
        expect(c.some((x) => x.text.includes('Spisová značka 12 C 345/2026 je uvedena'))).toBe(true);
    });
    it('blocks on missing recipient, subject or attachment, empty file and oversize', () => {
        expect(hasBlocker(texts({ recipientId: 'ab' }))).toBe(true);
        expect(hasBlocker(texts({ annotation: '  ' }))).toBe(true);
        expect(hasBlocker(texts({ files: [] }))).toBe(true);
        expect(hasBlocker(texts({ files: [{ name: 'a.pdf', size: 0, type: '' }] }))).toBe(true);
        expect(hasBlocker(texts({ files: [{ name: 'a.pdf', size: 11 * 1024 * 1024, type: '' }] }))).toBe(true);
        expect(hasBlocker(texts({ files: [{ name: 'prilohy.zip', size: 10, type: '' }] }))).toBe(true);
    });
    it('warns about a missing or different file number and a different authority', () => {
        expect(texts({ annotation: 'Vyjádření k žalobě' }).some((x) => x.level === 'warn' && /chybí spisová značka/.test(x.text))).toBe(true);
        expect(texts({ annotation: 'Vyjádření, sp. zn. 5 C 1/2025' }).some((x) => x.level === 'warn' && /správného řízení/.test(x.text))).toBe(true);
        expect(texts({ recipientName: 'Krajský soud v Praze' }).some((x) => x.level === 'warn' && /veden u/.test(x.text))).toBe(true);
    });
    it('warns about draft-like names, duplicate files and unusual formats; informs about unsigned PDF', () => {
        expect(texts({ files: [{ name: 'vyjadreni-koncept.pdf', size: 5, type: '' }] }).some((x) => x.level === 'warn' && /koncept/.test(x.text))).toBe(true);
        expect(texts({ files: [{ name: 'a.pdf', size: 5, type: '' }, { name: 'A.pdf', size: 5, type: '' }] }).some((x) => /stejný název/.test(x.text))).toBe(true);
        expect(texts({ files: [{ name: 'a.xyz', size: 5, type: '' }] }).some((x) => x.level === 'warn' && /neobvyklý formát/.test(x.text))).toBe(true);
        expect(texts({ files: [{ name: 'a.pdf', size: 5, type: '', signed: false }] }).some((x) => x.level === 'info' && /podpis/.test(x.text))).toBe(true);
    });
    it('reports overdue and today deadlines of the case, and production environment', () => {
        expect(texts({ deadlines: [{ title: 'Odvolání', due: '2026-11-10', done: false }] }).some((x) => x.level === 'warn' && /po termínu/.test(x.text))).toBe(true);
        expect(texts({ deadlines: [{ title: 'Odpor', due: '2026-11-17', done: false }] }).some((x) => x.level === 'warn' && /DNES/.test(x.text))).toBe(true);
        expect(texts({ deadlines: [{ title: 'Vyjádření', due: '2026-11-30', done: false }] }).some((x) => x.level === 'info' && /za 13 dní/.test(x.text))).toBe(true);
        expect(texts({ deadlines: [{ title: 'Hotovo', due: '2026-11-10', done: true }] }).some((x) => /po termínu/.test(x.text))).toBe(false);
        expect(texts({ prod: true }).some((x) => /OSTRÉHO/.test(x.text))).toBe(true);
    });
    it('recognises Czech file numbers', () => {
        const m = 'sp. zn. 12 C 345/2026 a KSPL 45 INS 1234/2026'.match(FILE_NO) ?? [];
        expect(m.length).toBe(2);
    });
});
