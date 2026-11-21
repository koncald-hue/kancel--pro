'use client';

import { LockKeyhole, X } from 'lucide-react';
import { clearLockReason } from '@/lib/e2ee';
import { useLockReason, useMasterKey } from '@/lib/useE2ee';

// Vysvětlení, proč se šifrovaný obsah najednou nezobrazuje. Klíč se drží jen v paměti stránky, takže
// obnovení stránky nebo 30 minut nečinnosti ho zamkne. Rozepsaný text na stránce se tím nemaže.
export default function E2eeLockNotice() {
    const reason = useLockReason();
    const key = useMasterKey();
    if (key || (reason !== 'idle' && reason !== 'reload')) return null;
    return (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
            <LockKeyhole size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="flex-1">{reason === 'idle' ? 'Šifrování se po 30 minutách nečinnosti zamklo.' : 'Po obnovení stránky je šifrování zamčené.'} Šifrované zprávy a soubory teď nejsou vidět, nic se ale nesmazalo. Až je budete potřebovat, odemkněte je znovu šifrovacím heslem (např. ve spisu v záložce Klient).</p>
            <button type="button" onClick={clearLockReason} aria-label="Zavřít upozornění" className="rounded p-1 hover:bg-indigo-100 cursor-pointer"><X size={15} /></button>
        </div>
    );
}
