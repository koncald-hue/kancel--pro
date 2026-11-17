import { supabase } from './supabase';
import type { ActivityKind } from './workLog';

// Zápis úkonu do stopy práce (jen druh, věc, čas a název; nikdy obsah). Chyba zápisu nikdy nesmí rušit práci.
// Stejný úkon (např. opakované otevření téže zprávy) se během 30 minut zapíše jen jednou.
const recent = new Map<string, number>();
export function logActivity(kind: ActivityKind, opt: { caseId?: string | null; label?: string; ref?: string; words?: number } = {}): void {
    const key = opt.ref ? `${kind}:${opt.ref}` : '';
    const now = Date.now();
    if (key) { const last = recent.get(key); if (last && now - last < 30 * 60_000) return; recent.set(key, now); }
    void (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user.id; if (!uid) return;
        await supabase.from('work_activity').insert({ user_id: uid, case_id: opt.caseId || null, kind, label: (opt.label ?? '').slice(0, 200), ref: (opt.ref ?? '').slice(0, 200), words: Math.max(0, Math.round(opt.words ?? 0)) });
    })().catch(() => undefined);
}

// Úkon zapsaný bez věci (např. přečtený e-mail) se přiřadí k věci, jakmile ho advokát do věci uloží
export function assignActivity(ref: string, caseId: string): void {
    void supabase.from('work_activity').update({ case_id: caseId }).eq('ref', ref).is('case_id', null).then(() => undefined, () => undefined);
}
