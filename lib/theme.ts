// Světlý / tmavý režim. Volba se pamatuje v zařízení a třída „dark“ na <html> přepíná barvy (viz app/globals.css).
export type ThemePref = 'light' | 'dark' | 'system';
export const THEME_KEY = 'kancelar-theme';
export const THEME_OPTIONS: [ThemePref, string][] = [['light', 'Světlý'], ['dark', 'Tmavý'], ['system', 'Podle zařízení']];

export const isThemePref = (v: unknown): v is ThemePref => v === 'light' || v === 'dark' || v === 'system';
export const resolveTheme = (pref: ThemePref, systemDark: boolean): 'light' | 'dark' => (pref === 'system' ? (systemDark ? 'dark' : 'light') : pref);

const listeners = new Set<() => void>();
export function getThemePref(): ThemePref { try { const v = localStorage.getItem(THEME_KEY); return isThemePref(v) ? v : 'light'; } catch { return 'light'; } }

export function applyTheme(pref = getThemePref()) {
    const dark = resolveTheme(pref, window.matchMedia('(prefers-color-scheme: dark)').matches) === 'dark';
    document.documentElement.classList.toggle('dark', dark);
}
export function setThemePref(pref: ThemePref) {
    try { localStorage.setItem(THEME_KEY, pref); } catch { /* bez úložiště platí volba jen do obnovení stránky */ }
    applyTheme(pref); listeners.forEach((l) => l());
}
export function subscribeTheme(cb: () => void) {
    listeners.add(cb);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => { applyTheme(); cb(); };
    mq.addEventListener('change', onSystem); window.addEventListener('storage', onSystem);
    return () => { listeners.delete(cb); mq.removeEventListener('change', onSystem); window.removeEventListener('storage', onSystem); };
}

// Skript do <head>: nastaví třídu ještě před vykreslením, aby stránka při načtení nebliknula světlá
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;
