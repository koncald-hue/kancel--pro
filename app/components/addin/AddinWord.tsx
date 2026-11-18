'use client';

import { useState } from 'react';
import { CheckCircle2, FilePlus2, Loader2, TextCursorInput, Timer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { insertRow, loadBundle, uploadCaseFile } from '@/lib/caseFile';
import { findSameName, nextVersionInfo } from '@/lib/fileVersions';
import { wordFile, wordInsertText } from '@/lib/officeBridge';
import { clientBlock } from '@/lib/caseBlock';
import { todayIso } from '@/lib/billing';
import { ghostBtn, primaryBtn } from '../situation/caseUi';
import { useLawyer } from '../lawyer/LawyerGate';
import { AddinFrame, CasePicker, useOfficeReady, useOpenCases } from './AddinCommon';

function Panel() {
    const { userId, access } = useLawyer();
    const cases = useOpenCases();
    const office = useOfficeReady();
    const [caseId, setCaseId] = useState('');
    const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
    const item = cases?.find((c) => c.id === caseId);

    async function run(kind: string, fn: () => Promise<string>) {
        setBusy(kind); setMsg(''); setErr('');
        try { setMsg(await fn()); } catch (e) { setErr(e instanceof Error ? e.message : 'Nepodařilo se.'); } finally { setBusy(''); }
    }
    const save = () => run('save', async () => {
        const { name, blob } = await wordFile();
        const file = new File([blob], name, { type: blob.type });
        const bundle = await loadBundle(caseId);
        const same = findSameName(bundle.files, null, name);
        await uploadCaseFile(userId, caseId, null, file, same ? nextVersionInfo(bundle.files, same) : {});
        await insertRow('case_entries', { case_id: caseId, user_id: userId, kind: 'event', title: `Dokument uložen z Wordu: ${name}`.slice(0, 200), body: same ? 'Nová verze souboru.' : '', happened_on: todayIso() });
        return same ? `Uloženo jako nová verze souboru „${name}“.` : `Uloženo do věci: ${name}.`;
    });
    const insert = () => run('insert', async () => { if (!item) throw new Error('Vyberte věc.'); await wordInsertText(clientBlock(item, access.firm_name || access.display_name || '')); return 'Údaje věci jsou vložené v dokumentu.'; });
    const time = () => run('time', async () => {
        const { error } = await supabase.from('time_entries').insert({ case_id: caseId, user_id: userId, entry_date: todayIso(), minutes: 12, rate: access.default_rate || 0, description: 'Úprava dokumentu ve Wordu' });
        if (error) throw new Error(error.message);
        return 'Zapsáno 12 minut práce na věci.';
    });

    if (office === 'wait') return <p className="text-xs text-slate-500" role="status">Připojuji se k Wordu…</p>;
    if (office === 'none') return <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950" role="alert">Rozhraní Wordu se nenačetlo. Doplněk se otevírá uvnitř Wordu (Vložit → Moje doplňky). V prohlížeči funguje jen přihlášení.</p>;
    if (!cases) return <p className="text-xs text-slate-500" role="status">Načítám věci…</p>;
    return (
        <div className="space-y-3">
            <CasePicker cases={cases} value={caseId} onChange={setCaseId} />
            <div className="grid gap-2">
                <button type="button" disabled={!caseId || !!busy} onClick={() => void save()} className={`${primaryBtn} justify-center`}>{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />} Uložit tento dokument do věci</button>
                <button type="button" disabled={!caseId || !!busy} onClick={() => void insert()} className={`${ghostBtn} justify-center`}>{busy === 'insert' ? <Loader2 size={14} className="animate-spin" /> : <TextCursorInput size={14} />} Vložit údaje věci do dokumentu</button>
                <button type="button" disabled={!caseId || !!busy} onClick={() => void time()} className={`${ghostBtn} justify-center`}><Timer size={14} /> Zapsat 12 minut práce</button>
            </div>
            {msg && <p role="status" className="flex items-start gap-1.5 text-xs font-semibold text-emerald-800"><CheckCircle2 size={14} className="mt-px shrink-0" aria-hidden="true" /> {msg}</p>}
            {err && <p role="alert" className="text-xs font-semibold text-rose-800">{err}</p>}
            <p className="text-[11px] leading-relaxed text-slate-500">Dokument se uloží do souborů věci (stejná věc ve Vaší Kanceláři) a při stejném názvu vznikne nová verze.</p>
        </div>
    );
}

export default function AddinWord() { return <AddinFrame title="Word"><Panel /></AddinFrame>; }
