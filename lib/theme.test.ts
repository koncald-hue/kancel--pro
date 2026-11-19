import { describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT, isThemePref, resolveTheme } from './theme';

describe('světlý a tmavý režim', () => {
    it('podle zařízení se řídí systémem, ostatní volby jsou pevné', () => {
        expect(resolveTheme('system', true)).toBe('dark');
        expect(resolveTheme('system', false)).toBe('light');
        expect(resolveTheme('light', true)).toBe('light');
        expect(resolveTheme('dark', false)).toBe('dark');
    });
    it('neplatnou uloženou hodnotu odmítne', () => {
        expect(isThemePref('dark')).toBe(true);
        expect(isThemePref('<script>')).toBe(false);
        expect(isThemePref(null)).toBe(false);
    });
    it('úvodní skript je platný JavaScript a obsahuje klíč úložiště', () => {
        expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
        expect(THEME_INIT_SCRIPT).toContain('kancelar-theme');
    });
});
