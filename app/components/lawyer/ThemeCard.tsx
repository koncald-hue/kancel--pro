'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Monitor, Sun } from 'lucide-react';
import { THEME_OPTIONS, getThemePref, setThemePref, subscribeTheme, type ThemePref } from '@/lib/theme';

const ICON: Record<ThemePref, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

// Vzhled aplikace: světlý, tmavý nebo podle zařízení. Nastavení se pamatuje jen v tomto zařízení.
export default function ThemeCard() {
    const pref = useSyncExternalStore(subscribeTheme, getThemePref, () => 'light' as ThemePref);
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="theme-h">
            <h2 id="theme-h" className="flex items-center gap-2 text-lg font-bold text-slate-900"><Moon size={18} className="text-indigo-700" aria-hidden="true" /> Vzhled</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Zvolte světlý nebo tmavý režim, nebo nechte aplikaci řídit se nastavením zařízení. Volba platí jen na tomto zařízení.</p>
            <div role="radiogroup" aria-label="Režim vzhledu" className="mt-3 inline-flex flex-wrap gap-2">
                {THEME_OPTIONS.map(([id, label]) => {
                    const Icon = ICON[id]; const on = pref === id;
                    return (
                        <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setThemePref(id)} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${on ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                            <Icon size={15} aria-hidden="true" /> {label}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
