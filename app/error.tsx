'use client';

import { useEffect } from 'react';
import { reportError } from '@/app/components/site/ErrorReporter';

// Záchytná stránka: když se něco pokazí, uživatel vidí srozumitelnou zprávu a chyba se zapíše pro Správu
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
    useEffect(() => { reportError(error, 'boundary'); }, [error]);
    return (
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Něco se pokazilo</h1>
            <p className="mt-2 text-slate-600">Chybu jsme si zaznamenali a podíváme se na ni. Zkuste stránku načíst znovu. Vaše data jsou v pořádku.</p>
            <button type="button" onClick={() => retry()} className="mt-5 cursor-pointer rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Zkusit znovu</button>
        </main>
    );
}
