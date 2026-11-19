'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FilePlus2, FileText, ListChecks, Loader2, TextCursorInput, Timer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { insertRow, loadBundle, uploadCaseFile } from '@/lib/caseFile';
import { findSameName, nextVersionInfo } from '@/lib/fileVersions';
import { wordFile, wordInsertText } from '@/lib/officeBridge';
import { clientBlock, deadlinesBlock } from '@/lib/caseBlock';
import { loadCaseExtras } from '@/lib/caseExtras';
import { plainPreview } from '@/lib/docx';
import { autoValues, customLabel, fieldsIn, fillTemplate, type CaseExtras, type LawyerTemplate } from '@/lib/templates';
import { todayIso } from '@/lib/billing';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from '../lawyer/LawyerGate';
import { AddinFrame, CasePicker, useOfficeReady, useOpenCases } from './AddinCommon';

function Panel() {
    const { userId, access } = useLawyer();
    const cases = useOpenCases();
    const office = useOfficeReady();
    const [caseId, setCaseId] = useState('');
    const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
    const item = cases?.find((c) => c.id === caseId);
    // Vzory z knihovny: doplní se údaje ze spisu (klient, protistrana, soud, lhůta, hodiny) a vloží se na místo kurzoru
    const [templates, setTemplates] = useState<LawyerTemplate[]>([]);
    const [tplId, setTplId] = useState('');
    const [custom, setCustom] = useState<Record<string, string>>({});
    const [extras, setExtras] = useState<{ id: string; x: CaseExtras } | null>(null);
    const [client, setClient] = useState<{ id: string; address?: string; ico?: string; dic?: string; birth?: string | null } | null>(null);
    useEffect(() => { let a = true; supabase.from('lawyer_templates').select('*').order('title').then(({ data }) => { if (a && data) setTemplates(data as LawyerTemplate[]); }); return () => { a = false; }; }, []);
    useEffect(() => {
        if (!caseId) return; let a = true;
        loadCaseExtras(caseId).then((x) => { if (a) setExtras({ id: caseId, x }); }).catch(() => {});
        const cid = cases?.find((c) => c.id === caseId)?.client_id;
        if (cid) supabase.from('lawyer_clients').select('id, address, ico, dic, birth').eq('id', cid).maybeSingle().then(({ data }) => { if (a) setClient(data); });
        return () => { a = false; };
    }, [caseId, cases]);
    const tpl = templates.find((t) => t.id === tplId) ?? null;
    const auto = useMemo(() => autoValues(item ?? null, access, undefined, client?.id === item?.client_id ? client : null, extras?.id === caseId ? extras.x : null), [item, access, client, extras, caseId]);
    const customKeys = useMemo(() => (tpl ? fieldsIn(tpl.body).custom : []), [tpl]);
    const filled = tpl ? fillTemplate(tpl.body, auto, custom) : '';

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

    const insertTemplate = () => run('tpl', async () => {
        if (!tpl) throw new Error('Vyberte vzor.');
        await wordInsertText(plainPreview(filled));
        const left = fieldsIn(filled); const n = left.auto.length + left.custom.length;
        return n ? `Vzor vložen. Zbývá doplnit ${n} polí (jsou v textu ve složených závorkách).` : 'Vzor vložen a vyplněn údaji ze spisu.';
    });
    const insertDeadlines = () => run('dl', async () => {
        const text = deadlinesBlock(extras?.id === caseId ? extras.x.deadlines ?? [] : []);
        if (!text) throw new Error('Věc nemá žádné nesplněné lhůty.');
        await wordInsertText(text); return 'Lhůty věci vloženy.';
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
            {caseId && (
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <label className="block text-xs font-semibold text-slate-600">Vzor ze spisu
                        <select value={tplId} onChange={(e) => { setTplId(e.target.value); setCustom({}); }} className={`${inputCls} mt-1 font-normal`}>
                            <option value="">{templates.length ? 'Vyberte vzor…' : 'Knihovna vzorů je prázdná'}</option>
                            {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </label>
                    {customKeys.slice(0, 12).map((k) => (
                        <label key={k} className="block text-[11px] font-semibold text-slate-600">{customLabel(k)}
                            <input value={custom[k] ?? ''} onChange={(e) => setCustom({ ...custom, [k]: e.target.value })} className={`${inputCls} mt-0.5 font-normal`} />
                        </label>
                    ))}
                    {customKeys.length > 12 && <p className="text-[11px] text-slate-500">Dalších {customKeys.length - 12} polí doplníte přímo ve Wordu.</p>}
                    <button type="button" disabled={!tpl || !!busy} onClick={() => void insertTemplate()} className={`${primaryBtn} w-full justify-center`}>{busy === 'tpl' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Vložit vzor do dokumentu</button>
                    <button type="button" disabled={!!busy} onClick={() => void insertDeadlines()} className={`${ghostBtn} w-full justify-center`}>{busy === 'dl' ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />} Vložit lhůty věci</button>
                </div>
            )}
            {msg && <p role="status" className="flex items-start gap-1.5 text-xs font-semibold text-emerald-800"><CheckCircle2 size={14} className="mt-px shrink-0" aria-hidden="true" /> {msg}</p>}
            {err && <p role="alert" className="text-xs font-semibold text-rose-800">{err}</p>}
            <p className="text-[11px] leading-relaxed text-slate-500">Dokument se uloží do souborů věci (stejná věc ve Vaší Kanceláři) a při stejném názvu vznikne nová verze.</p>
        </div>
    );
}

export default function AddinWord() { return <AddinFrame title="Word"><Panel /></AddinFrame>; }
