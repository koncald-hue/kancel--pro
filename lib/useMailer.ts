'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { credsOf, mailApi, type MailAccountRow } from './mailClient';
import type { MailCreds } from './mailServer';
import { useMasterKey } from './useE2ee';

// Odesílání z advokátovy vlastní připojené schránky (odesílatel je advokát, ne aplikace). Heslo se odemyká hlavním klíčem v prohlížeči.
export type MailerState = { status: 'loading' | 'no-account' | 'locked' | 'ready' | 'error'; email: string; send: (m: { to: string; subject: string; text: string }) => Promise<void> };
export function useMailer(): MailerState {
    const master = useMasterKey();
    const [acc, setAcc] = useState<MailAccountRow | null | undefined>(undefined);
    const [creds, setCreds] = useState<MailCreds | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let alive = true;
        supabase.from('mail_accounts').select('*').order('created_at').limit(1).then(({ data, error }) => { if (alive) setAcc(error ? null : ((data ?? [])[0] as MailAccountRow | undefined) ?? null); });
        return () => { alive = false; };
    }, []);
    useEffect(() => {
        let alive = true;
        if (!master || !acc) { Promise.resolve().then(() => { if (alive) setCreds(null); }); return () => { alive = false; }; }
        credsOf(master, acc).then((c) => { if (alive) { setCreds(c); setFailed(false); } }).catch(() => { if (alive) { setCreds(null); setFailed(true); } });
        return () => { alive = false; };
    }, [master, acc]);
    const send = useCallback(async (m: { to: string; subject: string; text: string }) => {
        if (!creds) throw new Error('Schránka není odemčená.');
        await mailApi('send', creds, { mail: { to: m.to, cc: '', subject: m.subject, text: m.text, attachments: [] } });
    }, [creds]);
    const status: MailerState['status'] = acc === undefined ? 'loading' : !acc ? 'no-account' : failed ? 'error' : !master || !creds ? 'locked' : 'ready';
    return { status, email: acc?.email ?? '', send };
}

export const MAILER_HINT: Record<Exclude<MailerState['status'], 'ready' | 'loading'>, string> = {
    'no-account': 'Nejdřív připojte e-mailovou schránku v sekci E-mail.',
    locked: 'Odemkněte šifrovací heslo (v sekci E-mail), aby se mohlo odesílat z vaší schránky.',
    error: 'Heslo ke schránce se nepodařilo odemknout. Otevřete sekci E-mail a zkuste to znovu.',
};
