import { describe, expect, it } from 'vitest';
import { auditCsv, type AuditRow } from './audit';

const row = (over: Partial<AuditRow> = {}): AuditRow => ({ at: '2030-03-01T10:00:00Z', actor_name: 'JUDr. Test', case_id: 'c', case_title: 'Spis A', action: 'zmeneno', entity: 'case_deadlines', summary: 'Odvolání', changed: ['due_date', 'confirmed_at'], ...over });

describe('auditCsv', () => {
    it('writes a header, BOM, semicolon separators and readable labels', () => {
        const csv = auditCsv([row()]);
        expect(csv.startsWith('﻿Čas;Kdo;Spis;Událost;Druh záznamu;Název;Změněno')).toBe(true);
        expect(csv).toContain('JUDr. Test;Spis A;Změněno;Lhůta / úkol;Odvolání;datum, potvrzení data');
    });
    it('neutralises spreadsheet formulas and quotes special characters', () => {
        const csv = auditCsv([row({ summary: '=HYPERLINK("http://x")', actor_name: 'A;B', case_title: '+cmd' })]);
        expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
        expect(csv).toContain('"A;B"');
        expect(csv).toContain(";'+cmd;");
    });
    it('handles empty input', () => { expect(auditCsv([]).trim()).toContain('Čas;Kdo'); });
});
