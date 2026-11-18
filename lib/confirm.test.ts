import { describe, expect, it, vi } from 'vitest';
import { confirmAction, confirmText, onConfirmRequest } from './confirm';

describe('confirm', () => {
    it('k mazání doplní nevratnost, když chybí', () => {
        expect(confirmText('Smazat soubor?')).toBe('Smazat soubor?\n\nSmazání je nevratné.');
        expect(confirmText('Opravdu smazat celý spis? Nelze vrátit zpět.')).toBe('Opravdu smazat celý spis? Nelze vrátit zpět.');
        expect(confirmText('Vystavit fakturu?')).toBe('Vystavit fakturu?');
    });
    it('předá požadavek hostiteli a vrátí jeho odpověď; nebezpečnost pozná z textu', async () => {
        const seen: { danger?: boolean; message: string }[] = [];
        onConfirmRequest((r) => { seen.push(r); r.resolve(true); });
        await expect(confirmAction('Smazat klienta?')).resolves.toBe(true);
        await expect(confirmAction('Vystavit fakturu?')).resolves.toBe(true);
        expect(seen.map((s) => s.danger)).toEqual([true, false]);
        onConfirmRequest(null);
    });
    it('bez hostitele použije prohlížečové potvrzení', async () => {
        const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        await expect(confirmAction('Smazat?')).resolves.toBe(false);
        expect(spy).toHaveBeenCalledWith('Smazat?\n\nSmazání je nevratné.');
        spy.mockRestore();
    });
});
