import { describe, expect, it } from 'vitest';
import { addYears, archState, protocolCsv } from './archive';

describe('archive', () => {
    it('přičtení let i u 29. února', () => { expect(addYears('2026-11-18', 10)).toBe('2036-11-18'); expect(addYears('2028-02-29', 1)).toBe('2029-02-28'); });
    it('stavy', () => {
        const t = '2026-11-18';
        expect(archState({ status: 'open' }, t)).toBe('aktivni');
        expect(archState({ status: 'done' }, t)).toBe('k-archivaci');
        expect(archState({ status: 'done', archived_on: '2020-01-01', archive_until: '2030-01-01' }, t)).toBe('archiv');
        expect(archState({ status: 'done', archived_on: '2016-01-01', archive_until: '2027-01-10' }, t)).toBe('brzy');
        expect(archState({ status: 'done', archived_on: '2016-01-01', archive_until: '2026-11-18' }, t)).toBe('uplynulo');
        expect(archState({ status: 'done', archived_on: '2016-01-01', archive_until: '2026-01-01', disposal: 'skartovano' }, t)).toBe('skartovano');
    });
    it('protokol CSV', () => {
        const csv = protocolCsv([{ done_on: '2026-11-18', action: 'skartace', case_title: 'Novák; spor', until_on: null, place: 'Sklep A', note: '' }]);
        expect(csv.split('\r\n')[1]).toBe('18. 11. 2026;Skartace;"Novák; spor";;Sklep A;');
    });
});
