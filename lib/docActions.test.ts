import { describe, expect, it } from 'vitest';
import { countWords, readMinutes, replyDrafts, replyDue } from './docActions';

describe('kroky po přijetí dokumentu', () => {
    it('čas čtení po šesti minutách, minimum 6', () => { expect(readMinutes(0)).toBe(6); expect(readMinutes(200)).toBe(6); expect(readMinutes(1100)).toBe(12); expect(readMinutes(5000)).toBe(54); });
    it('odpověď do tří pracovních dnů', () => { expect(replyDue('2026-11-13')).toBe('2026-11-19'); }); // 17. 11. je svátek
    it('počet slov', () => { expect(countWords('  ahoj   světe \n a ')).toBe(3); });
    it('návrhy odpovědi obsahují jméno, značku a podpis', () => {
        const d = replyDrafts({ name: 'pane Nováku', subject: 'x', caseTitle: 'Spor', reference: '1 C 2/2026', signature: 'JUDr. Test' });
        expect(d.length).toBe(3); expect(d[0].body).toContain('pane Nováku'); expect(d[0].body).toContain('1 C 2/2026'); expect(d.every((x) => x.body.endsWith('JUDr. Test'))).toBe(true);
    });
});
