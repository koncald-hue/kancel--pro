import { describe, expect, it } from 'vitest';
import { remedyProposal, remedyRule } from './remedyDefaults';
import { analyzeText } from './lhutyExtract';

describe('remedyDefaults', () => {
    it('civilní rozsudek → odvolání 15 dní (§ 204 o. s. ř.)', () => {
        const p = remedyProposal('Okresní soud v Plzni\nROZSUDEK\njménem republiky\n… žalobce Jan Novák proti žalovanému … se zamítá.');
        expect(p).toMatchObject({ lawKey: 'odvolani-civilni-soud', label: 'Odvolání', n: 15, unit: 'den' });
        expect(p?.law).toContain('§ 204');
    });
    it('platební rozkaz → odpor 15 dní', () => { expect(remedyProposal('PLATEBNÍ ROZKAZ\nŽalovanému se ukládá zaplatit…')).toMatchObject({ lawKey: 'odpor-platebni-rozkaz', n: 15 }); });
    it('evropský platební rozkaz se nenavrhuje (jiná lhůta)', () => { expect(remedyRule('EVROPSKÝ PLATEBNÍ ROZKAZ')).toBeNull(); });
    it('trestní příkaz → odpor 8 dní', () => { expect(remedyProposal('TRESTNÍ PŘÍKAZ\nObviněný se uznává vinným…')).toMatchObject({ lawKey: 'odvolani-trestni-prikaz', n: 8 }); });
    it('trestní rozsudek → odvolání 8 dní', () => { expect(remedyProposal('ROZSUDEK\nObžalovaný Jan N. je vinen, že … sp. zn. 3 T 45/2026')).toMatchObject({ lawKey: 'odvolani-trestni-rozsudek', n: 8 }); });
    it('trestní usnesení → stížnost 3 dny (§ 143 tr. ř.)', () => { const p = remedyProposal('USNESENÍ\nObviněný … trestní stíhání'); expect(p).toMatchObject({ lawKey: 'stiznost-usneseni-trestni', n: 3 }); expect(p?.law).toContain('§ 143'); });
    it('správní soudnictví → kasační stížnost', () => { expect(remedyProposal('ROZSUDEK\nKrajský soud … ve spisu žaloby proti rozhodnutí … sp. zn. 30 A 12/2025, podle soudního řádu správního')).toMatchObject({ lawKey: 'kasacni-stiznost-nss', n: 14 }); });
    it('rozsudek odvolacího soudu → dovolání 2 měsíce', () => { expect(remedyProposal('ROZSUDEK\nKrajský soud v Plzni jako soud odvolací … rozsudek soudu prvního stupně se potvrzuje.')).toMatchObject({ lawKey: 'dovolani-obcanske-rizeni', n: 2, unit: 'mesic' }); });
    it('rozhodnutí úřadu → odvolání 15 dní (správní řád)', () => { expect(remedyProposal('Městský úřad Klatovy, odbor dopravy\nROZHODNUTÍ\n…')).toMatchObject({ lawKey: 'odvolani-spravni-rizeni', n: 15 }); });
    it('civilní usnesení, které jen zmiňuje rozsudek, se nehádá', () => { expect(remedyRule('USNESENÍ\nSoud rozhodl o nákladech řízení podle rozsudku ze dne…')).toBeNull(); });
    it('nepřípustný opravný prostředek nebo neznámý dokument: nic', () => {
        expect(remedyRule('USNESENÍ … Proti tomuto usnesení není odvolání přípustné.')).toBeNull();
        expect(remedyRule('VÝZVA k doplnění podání')).toBeNull();
    });
    it('analyzeText: když poučení lhůtu uvádí, druhý návrh nepřidá; když ne, přidá označený návrh', () => {
        const withPouceni = analyzeText('ROZSUDEK\n… Poučení: Proti tomuto rozsudku lze podat odvolání do 15 dnů ode dne doručení jeho písemného vyhotovení.', 'x');
        expect(withPouceni.candidates.filter((c) => c.label.startsWith('Odvolání'))).toHaveLength(1);
        expect(withPouceni.candidates[0].statutory).toBeFalsy();
        const without = analyzeText('Okresní soud\nROZSUDEK\n… žaloba se zamítá.', 'y');
        const c = without.candidates.find((x) => x.statutory);
        expect(c).toMatchObject({ label: 'Odvolání', n: 15, unit: 'den', trigger: 'doruceni', lawKey: 'odvolani-civilni-soud', confidence: 'stredni' });
        expect(c?.warnings[0]).toMatch(/Ověřte poučení/);
    });
});
