'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MailPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { insertRow, loadBundle, uploadCaseFile } from '@/lib/caseFile';
import { matchCases } from '@/lib/mailMatch';
import { mailAttachment, mailInfo, type MailInfo } from '@/lib/officeBridge';
import AiRouteSuggest from '../lawyer/AiRouteSuggest';
import { primaryBtn } from '../situation/caseUi';
import { useLawyer } from '../lawyer/LawyerGate';
import { AddinFrame, CasePicker, useOfficeReady, useOpenCases } from './AddinCommon';

function Panel() {
    const { userId } = useLawyer();
    const cases = useOpenCases();
    const office = useOfficeReady();
    const [mail, setMail] = useState<MailInfo | null>(null);
    const [clients, setClients] = useState<{ id: string; email: string; name?: string }[]>([]);
    const [caseId, setCaseId] = useState(''); const [picked, setPicked] = useState(false);
    const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
    const [withAtt, setWithAtt] = useState(true);

    useEffect(() => {
        if (office !== 'ready') return;
        let a = true;
        mailInfo().then((m) => { if (a) setMail(m); }).catch((e) => { if (a) setErr(e instanceof Error ? e.message : 'Zprávu se nepodařilo načíst.'); });
        supabase.from('lawyer_clients').select('id, email, name').then(({ data }) => { if (a && data) setClients(data as { id: string; email: string; name?: string }[]); });
        return () => { a = false; };
    }, [office]);

    const matches = useMemo(() => (mail && cases ? matchCases({ counterparty: mail.fromEmail, subject: mail.subject, text: mail.body }, cases.map((c) => ({ id: c.id, title: c.title, client_id: c.client_id ?? null, client_email: c.client_email ?? null, client_name: c.client_name ?? null, reference: c.reference ?? null, status: c.status })), clients) : []), [mail, cases, clients]);
    const chosen = picked ? caseId : (caseId || (matches[0] && matches[0].score >= 70 ? matches[0].caseId : ''));
    const hint = Object.fromEntries(matches.map((m) => [m.caseId, m.reason]));
    const real = (mail?.attachments ?? []).filter((x) => !x.inline);

    async function save() {
        if (!mail || !chosen) return;
        setBusy(true); setMsg(''); setErr('');
        try {
            let n = 0;
            if (withAtt && real.length) {
                const bundle = await loadBundle(chosen);
                const folder = bundle.folders.find((f) => f.name === 'Korespondence')?.id ?? null;
                for (const att of real) { const f = await mailAttachment(att.id, att.name, att.contentType); if (f) { await uploadCaseFile(userId, chosen, folder, f); n++; } }
            }
            await insertRow('case_entries', { case_id: chosen, user_id: userId, kind: 'event', title: `E-mail: ${mail.subject}`.slice(0, 200), body: `Od: ${mail.fromName} <${mail.fromEmail}>\nKomu: ${mail.to.join(', ')}\nDatum: ${mail.received ? new Date(mail.received).toLocaleString('cs-CZ') : ''}${n ? `\nPřílohy uloženy do souborů spisu: ${n}` : ''}\n\n${mail.body.slice(0, 6000)}`, happened_on: mail.received ? mail.received.slice(0, 10) : null });
            setMsg(`Uloženo do spisu${n ? `, včetně ${n} příloh` : ''}.`);
        } catch (e) { setErr(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(false); }
    }

    if (office === 'wait') return <p className="text-xs text-slate-500" role="status">Připojuji se k Outlooku…</p>;
    if (office === 'none') return <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950" role="alert">Rozhraní Outlooku se nenačetlo. Doplněk se otevírá uvnitř Outlooku u otevřené zprávy.</p>;
    if (!cases || !mail) return <p className={err ? 'text-xs font-semibold text-rose-800' : 'text-xs text-slate-500'} role={err ? 'alert' : 'status'}>{err || 'Načítám zprávu…'}</p>;
    return (
        <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 p-2.5 text-xs"><p className="font-semibold text-slate-900">{mail.subject || '(bez předmětu)'}</p><p className="text-slate-500">Od: {mail.fromName || mail.fromEmail}{real.length ? ` · ${real.length} příloh` : ''}</p></div>
            <CasePicker cases={cases} value={chosen} onChange={(id) => { setCaseId(id); setPicked(true); }} hint={hint} />
            {!picked && matches[0] && matches[0].score >= 70 && <p className="text-xs text-indigo-900">Navrženo podle: {matches[0].reason}.</p>}
            {!chosen && <AiRouteSuggest mail={{ subject: mail.subject, text: mail.body }} cases={cases.map((c) => ({ id: c.id, title: c.title }))} onPick={(id) => { setCaseId(id); setPicked(true); }} />}
            {real.length > 0 && <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={withAtt} onChange={(e) => setWithAtt(e.target.checked)} /> Uložit i přílohy do složky Korespondence</label>}
            <button type="button" disabled={!chosen || busy} onClick={() => void save()} className={`${primaryBtn} w-full justify-center`}>{busy ? <Loader2 size={14} className="animate-spin" /> : <MailPlus size={14} />} Uložit e-mail do spisu</button>
            {msg && <p role="status" className="flex items-start gap-1.5 text-xs font-semibold text-emerald-800"><CheckCircle2 size={14} className="mt-px shrink-0" aria-hidden="true" /> {msg}</p>}
            {err && <p role="alert" className="text-xs font-semibold text-rose-800">{err}</p>}
        </div>
    );
}

export default function AddinOutlook() { return <AddinFrame title="Outlook"><Panel /></AddinFrame>; }
