'use client';

import { useEffect } from 'react';

let sent = 0;
// Odešle chybu do záznamu (nejvýše 5 za návštěvu, aby jedna chyba neobtěžovala server)
export function reportError(error: unknown, source: 'client' | 'boundary' = 'client') {
    if (sent >= 5) return;
    sent += 1;
    try {
        const e = error as { message?: unknown; stack?: unknown } | string | null;
        const message = typeof e === 'string' ? e : String((e && typeof e === 'object' && e.message) || '');
        const stack = e && typeof e === 'object' && typeof e.stack === 'string' ? e.stack : '';
        void fetch('/api/log-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, stack, page: window.location.pathname, source }), keepalive: true }).catch(() => undefined);
    } catch { /* záznam chyb nesmí způsobit další chybu */ }
}

// Zachytává chyby v prohlížeči a nezachycené chyby ve slibech
export default function ErrorReporter() {
    useEffect(() => {
        const onError = (ev: ErrorEvent) => reportError(ev.error ?? ev.message);
        const onRejection = (ev: PromiseRejectionEvent) => reportError(ev.reason);
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
    }, []);
    return null;
}
