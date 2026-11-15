import { describe, expect, it } from 'vitest';
import { attachmentsOf, buildDossierHtml, DEFAULT_EXPORT } from './caseExport';
import type { CaseBundle } from './caseFile';
import type { LegalCase } from './cases';

const item = { id: 'c1', title: 'Pokuta <za rychlost>', situation: 'Dostal jsem pokutu.', summary: '', urgency: 'medium', steps: [{ text: 'Podat odpor', done: true }], deadline_ids: [], offense_ids: [], template_keys: [], event_date: null, note: '', status: 'open', pinned: false, reference: 'č. j. 123/2026', authority: 'MÚ Plzeň', client_name: 'Jan Novák', created_at: '2026-11-01T10:00:00Z' } as LegalCase;
const bundle: CaseBundle = {
    folders: [{ id: 'f1', case_id: 'c1', name: 'Důkazy' }],
    files: [
        { id: 'a', case_id: 'c1', folder_id: 'f1', name: 'foto.jpg', path: 'p/a', size: 100, mime: 'image/jpeg', note: '', created_at: '2026-11-02T10:00:00Z' },
        { id: 'b', case_id: 'c1', folder_id: null, name: 'příkaz.pdf', path: 'p/b', size: 2048, mime: 'application/pdf', note: '', created_at: '2026-11-03T10:00:00Z' },
    ],
    entries: [{ id: 'e', case_id: 'c1', kind: 'note', title: 'Soukromá poznámka', body: '', happened_on: null, pinned: false, created_at: '2026-11-03T10:00:00Z' }],
    deadlines: [], contacts: [],
};

describe('case dossier', () => {
    it('numbers attachments consistently and escapes user text', () => {
        const attachments = attachmentsOf(bundle);
        expect(attachments.map((a) => a.zipPath)).toEqual(['prilohy/01-příkaz.pdf', 'prilohy/02-foto.jpg']);
        const html = buildDossierHtml(item, bundle, [], DEFAULT_EXPORT);
        expect(html).toContain('Pokuta &lt;za rychlost&gt;');
        expect(html).toContain('č. j. 123/2026');
        expect(html).toContain('Příloha č. 2');
        expect(html).toContain('Soukromá poznámka');
    });

    it('leaves out notes and defense when not selected', () => {
        const html = buildDossierHtml(item, bundle, [], { ...DEFAULT_EXPORT, notes: false });
        expect(html).not.toContain('Soukromá poznámka');
        expect(html).not.toContain('Podklad k obhajobě');
    });
});
