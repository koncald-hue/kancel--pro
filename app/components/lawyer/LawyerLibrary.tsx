'use client';

import { confirmAction } from '@/lib/confirm';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, Download, FilePlus2, Library, Loader2, Pencil, Plus, Printer, Trash2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadCases, type LegalCase } from '@/lib/cases';
import { loadCaseExtras } from '@/lib/caseExtras';
import { AUTO_FIELDS, autoValues, buildDocx, type CaseExtras, customLabel, fieldsIn, fillTemplate, type LawyerTemplate } from '@/lib/templates';
import { insertRow, uploadCaseFile } from '@/lib/caseFile';
import { plainPreview } from '@/lib/docx';
import { STARTER_TEMPLATES } from '@/lib/starterTemplates';
import { logActivity } from '@/lib/activity';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

type View = { mode: 'list' } | { mode: 'edit'; id: string | null } | { mode: 'fill'; id: string };

const STARTER = `NÁZEV DOKUMENTU

{{advokat.kancelar}}
{{advokat.adresa}}

V {{misto}} dne {{datum}}

Věc: {{vec.nazev}}
Spisová značka: {{vec.spisova_znacka}}
Klient: {{klient.jmeno}}

Text dokumentu…

{{advokat.jmeno}}
advokát, ev. č. ČAK {{advokat.cak}}
`;

// Knihovna: vlastní vzory dokumentů s poli, která počítač vyplní z věci, klienta a profilu advokáta
export default function LawyerLibrary() {
    const { userId, access } = useLawyer();
    const [items, setItems] = useState<LawyerTemplate[] | null | undefined>(undefined);
    const [view, setView] = useState<View>({ mode: 'list' });
    const [error, setError] = useState('');

    async function reload() {
        const { data, error: err } = await supabase.from('lawyer_templates').select('*').order('updated_at', { ascending: false });
        if (err) { setError(/lawyer_templates|schema cache|does not exist/i.test(err.message) ? 'Vzory zatím nejsou v databázi zapnuté (chybí spuštění souboru poptavky-prilohy.sql).' : err.message); setItems(null); return; }
        setItems((data ?? []) as LawyerTemplate[]);
    }
    useEffect(() => {
        let alive = true;
        supabase.from('lawyer_templates').select('*').order('updated_at', { ascending: false }).then(({ data, error: err }) => {
            if (!alive) return;
            if (err) { setError(/lawyer_templates|schema cache|does not exist/i.test(err.message) ? 'Vzory zatím nejsou v databázi zapnuté (chybí spuštění souboru poptavky-prilohy.sql).' : err.message); setItems(null); return; }
            setItems((data ?? []) as LawyerTemplate[]);
        });
        return () => { alive = false; };
    }, []);

    if (items === undefined) return <p className="text-sm text-slate-500" role="status">Načítám…</p>;
    if (items === null) return <p role="alert" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">{error}</p>;

    if (view.mode === 'edit') return <Editor template={items.find((t) => t.id === view.id) ?? null} userId={userId} onDone={async () => { await reload(); setView({ mode: 'list' }); }} onCancel={() => setView({ mode: 'list' })} />;
    if (view.mode === 'fill') {
        const t = items.find((x) => x.id === view.id);
        if (t) return <Fill template={t} access={access} userId={userId} onBack={() => setView({ mode: 'list' })} />;
    }

    const mine = items.filter((t) => t.user_id === userId);
    const others = items.filter((t) => t.user_id !== userId);
    const row = (t: LawyerTemplate, own: boolean) => (
        <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{t.title}</p>
                <p className="truncate text-xs text-slate-500">{[t.category, `${fieldsIn(t.body).auto.length + fieldsIn(t.body).custom.length} polí`, t.shared && own ? 'sdíleno s kanceláří' : ''].filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" onClick={() => setView({ mode: 'fill', id: t.id })} className={primaryBtn}><FilePlus2 size={15} /> Vyplnit</button>
            {own && <button type="button" onClick={() => setView({ mode: 'edit', id: t.id })} className={ghostBtn}><Pencil size={14} /> Upravit</button>}
        </li>
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600">Vlastní vzory podání, smluv a dopisů. Do textu vložíte pole a počítač je vyplní z věci, klienta a vašeho profilu.</p>
                <button type="button" onClick={() => setView({ mode: 'edit', id: null })} className={primaryBtn}><Plus size={16} /> Nový vzor</button>
            </div>
            <StarterPack items={items} userId={userId} onAdded={reload} />
            <details className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm leading-relaxed text-slate-700">
                <summary className="cursor-pointer font-bold text-indigo-900">Jak vytvořit vzor dokumentu (návod)</summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5">
                    <li>Klikněte na <strong>Nový vzor</strong>, pojmenujte ho a případně zadejte kategorii (např. Dopisy, Podání, Smlouvy).</li>
                    <li>Do pole <strong>Text vzoru</strong> vložte hotový dokument, třeba zkopírovaný z Wordu. Jednoduché značení se do Wordu převede samo: řádek začínající <code className="rounded bg-white px-1">#</code> je nadpis dokumentu, <code className="rounded bg-white px-1">##</code> nadpis článku, <code className="rounded bg-white px-1">1.</code> číslovaný odstavec, <code className="rounded bg-white px-1">**text**</code> tučně, <code className="rounded bg-white px-1">| a | b |</code> tabulka a <code className="rounded bg-white px-1">::podpisy Klient | Advokát</code> místa pro podpis. Ostatní formátování si ve Wordu doupravíte.</li>
                    <li>Místa, která se u každého klienta mění, nahraďte <strong>poli</strong>. Klikněte na místo v textu a v pravém panelu zvolte pole, nebo ho napište rukou ve dvojitých složených závorkách, např. <code className="rounded bg-white px-1">{'{{klient.jmeno}}'}</code>.</li>
                    <li><strong>Pole, která vyplní počítač sám</strong> (z věci, klienta a vašeho profilu): klient (jméno, e-mail, telefon, adresa, IČO, DIČ), věc (název, spisová značka, soud či úřad, popis), advokát (jméno, kancelář, číslo ČAK, adresa, telefon, e-mail) a dnešní datum. Údaje o věci a klientovi se berou z karty věci, vyplňte je tam.</li>
                    <li><strong>Vlastní pole</strong> pro cokoli jiného: napište např. <code className="rounded bg-white px-1">{'{{castka}}'}</code> nebo <code className="rounded bg-white px-1">{'{{datum_splatnosti}}'}</code>. Při vyplňování se na ně program zeptá. Název pište bez mezer (místo mezery podtržítko), stejné pole použité víckrát se zadává jen jednou.</li>
                    <li>Zaškrtněte <strong>Sdílet s kolegy</strong>, mají-li vzor používat i ostatní v kanceláři. Upravovat ho můžete jen vy.</li>
                    <li><strong>Použití:</strong> u vzoru klikněte na Vyplnit, vyberte věc, doplňte vlastní pole a stáhněte hotový Word (.docx), nebo text zkopírujte či vytiskněte. Co zůstalo nevyplněné, je vidět jako <code className="rounded bg-white px-1">{'{{pole}}'}</code>, aby vám nic neuniklo.</li>
                </ol>
                <p className="mt-3 rounded-lg bg-white p-3 text-xs"><strong>Příklad:</strong> „Vážený pane {'{{klient.jmeno}}'}, vyzývám Vás k úhradě částky {'{{castka}}'} Kč do {'{{datum_splatnosti}}'}. Ve věci vedené pod sp. zn. {'{{vec.spisova_znacka}}'}. {'{{advokat.jmeno}}'}“. Po vyplnění: „Vážený pane Jan Novák, vyzývám Vás k úhradě částky 15 000 Kč do 30. 11. 2026…“ Dokument vždy před odesláním zkontrolujte, odpovídá za něj advokát.</p>
            </details>
            {mine.length === 0 && others.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
                    <Library size={28} className="mx-auto text-indigo-700" aria-hidden="true" />
                    <h2 className="mt-3 text-lg font-bold text-slate-900">Zatím tu nemáte žádný vzor</h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">Vložte text svého oblíbeného podání a na místa, která se mění, dejte pole, třeba {'{{klient.jmeno}}'} nebo {'{{castka}}'}. Příště stačí vybrat věc a dokument je hotový.</p>
                    <button type="button" onClick={() => setView({ mode: 'edit', id: null })} className={`${primaryBtn} mt-4`}><Plus size={16} /> Vytvořit první vzor</button>
                </div>
            )}
            {mine.length > 0 && <section><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Moje vzory</h2><ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">{mine.map((t) => row(t, true))}</ul></section>}
            {others.length > 0 && <section><h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Users size={13} /> Sdílené od kolegů</h2><ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">{others.map((t) => row(t, false))}</ul></section>}
        </div>
    );
}

function Editor({ template, userId, onDone, onCancel }: { template: LawyerTemplate | null; userId: string; onDone: () => Promise<void>; onCancel: () => void }) {
    const [title, setTitle] = useState(template?.title ?? '');
    const [category, setCategory] = useState(template?.category ?? '');
    const [body, setBody] = useState(template?.body ?? STARTER);
    const [shared, setShared] = useState(template?.shared ?? false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const area = useRef<HTMLTextAreaElement>(null);
    const [newField, setNewField] = useState('');
    const fields = useMemo(() => fieldsIn(body), [body]);

    function insert(key: string) {
        const el = area.current;
        const token = `{{${key}}}`;
        if (!el) { setBody((b) => b + token); return; }
        const start = el.selectionStart; const end = el.selectionEnd;
        setBody(body.slice(0, start) + token + body.slice(end));
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
    }
    function addCustom() {
        const key = newField.trim().replace(/[{}]/g, '').replace(/\s+/g, '_').slice(0, 40);
        if (!key) return;
        insert(key); setNewField('');
    }

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setError('');
        const row = { title: title.trim(), category: category.trim(), body, shared, updated_at: new Date().toISOString() };
        const { error: err } = template ? await supabase.from('lawyer_templates').update(row).eq('id', template.id) : await supabase.from('lawyer_templates').insert({ ...row, user_id: userId });
        setBusy(false);
        if (err) { setError(err.message); return; }
        await onDone();
    }
    async function remove() {
        if (!template || !await confirmAction('Opravdu smazat tento vzor?')) return;
        const { error: err } = await supabase.from('lawyer_templates').delete().eq('id', template.id);
        if (err) { setError(err.message); return; }
        await onDone();
    }

    const groups = ['Klient', 'Věc', 'Advokát', 'Obecné'] as const;
    return (
        <form onSubmit={save} className="space-y-4">
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"><ArrowLeft size={15} /> Zpět do knihovny</button>
            <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
                <label className="block text-xs font-semibold text-slate-600">Název vzoru *<input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} className={`${inputCls} mt-1 font-normal`} placeholder="např. Výzva k plnění" /></label>
                <label className="block text-xs font-semibold text-slate-600">Kategorie<input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} className={`${inputCls} mt-1 font-normal`} placeholder="např. Dopisy" /></label>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
                <label className="block text-xs font-semibold text-slate-600">Text vzoru
                    <textarea ref={area} value={body} onChange={(e) => setBody(e.target.value)} rows={22} maxLength={60000} className={`${inputCls} mt-1 font-mono text-[13px] font-normal leading-relaxed`} />
                </label>
                <aside className="space-y-3 text-xs">
                    <div>
                        <p className="font-bold uppercase tracking-wide text-slate-500">Vložit pole (na místo kurzoru)</p>
                        {groups.map((g) => (
                            <div key={g} className="mt-2"><p className="font-semibold text-slate-600">{g}</p><div className="mt-1 flex flex-wrap gap-1">{AUTO_FIELDS.filter((f) => f.group === g).map((f) => <button key={f.key} type="button" onClick={() => insert(f.key)} title={f.label} className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 cursor-pointer">{f.label}</button>)}</div></div>
                        ))}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-600">Vlastní pole (zeptá se při vyplňování)</p>
                        <div className="mt-1 flex gap-1"><input value={newField} onChange={(e) => setNewField(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} placeholder="např. castka" aria-label="Název vlastního pole" className={`${inputCls} py-1.5 text-xs`} /><button type="button" onClick={addCustom} className={ghostBtn}>Vložit</button></div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-slate-600">
                        <p className="font-semibold text-slate-700">V textu je {fields.auto.length + fields.custom.length} polí</p>
                        {fields.custom.length > 0 && <p className="mt-1">Doplníte ručně: {fields.custom.map(customLabel).join(', ')}.</p>}
                        <p className="mt-1">Pole můžete psát i rukou: {'{{klient.jmeno}}'}.</p>
                    </div>
                </aside>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-800" /><span>Sdílet s kolegy z kanceláře (uvidí a mohou vyplňovat, upravovat můžete jen vy)</span></label>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy || !title.trim()} className={primaryBtn}>{busy && <Loader2 size={15} className="animate-spin" />} Uložit vzor</button>
                <button type="button" onClick={onCancel} className={ghostBtn}>Zrušit</button>
                {template && <button type="button" onClick={() => void remove()} className={`${ghostBtn} ml-auto text-rose-800`}><Trash2 size={14} /> Smazat</button>}
            </div>
        </form>
    );
}

function Fill({ template, access, userId, onBack }: { template: LawyerTemplate; access: ReturnType<typeof useLawyer>['access']; userId: string; onBack: () => void }) {
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [clients, setClients] = useState<{ id: string; address?: string; ico?: string; dic?: string; birth?: string | null }[]>([]);
    const [caseId, setCaseId] = useState(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('case') ?? ''));
    const [custom, setCustom] = useState<Record<string, string>>({});
    const [override, setOverride] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [saving, setSaving] = useState(false);
    const fields = useMemo(() => fieldsIn(template.body), [template.body]);

    useEffect(() => { let alive = true; loadCases().then((c) => { if (alive) setCases(c); }).catch(() => {}); supabase.from('lawyer_clients').select('id, address, ico, dic, birth').then(({ data }) => { if (alive && data) setClients(data); }); return () => { alive = false; }; }, []);

    const chosen = cases.find((c) => c.id === caseId) ?? null;
    // Protistrana, lhůty a výkazy vybrané věci: doplní se do polí vzoru
    const [extras, setExtras] = useState<{ id: string; x: CaseExtras } | null>(null);
    useEffect(() => {
        if (!caseId) return; let alive = true;
        loadCaseExtras(caseId).then((x) => { if (alive) setExtras({ id: caseId, x }); }).catch(() => {});
        return () => { alive = false; };
    }, [caseId]);
    const auto = useMemo(() => ({ ...autoValues(chosen, access, undefined, clients.find((c) => c.id === chosen?.client_id), extras?.id === caseId ? extras.x : null), ...override }), [chosen, access, override, clients, extras, caseId]);
    const text = fillTemplate(template.body, auto, custom);
    const open = fieldsIn(text);
    const remaining = [...open.auto, ...open.custom];

    async function copy() { await navigator.clipboard?.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    async function download() {
        logActivity('document_created', { caseId: chosen?.id ?? null, label: template.title, ref: `tpl:${template.id}:${chosen?.id ?? ''}:${new Date().toDateString()}` });
        const blob = await buildDocx(text);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${template.title.replace(/[^\p{L}\p{N}]+/gu, '_')}.docx`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    // Vyplněný dokument se uloží do spisu vybrané věci (soubor Word) a zapíše se do chronologie
    async function saveToCase() {
        if (!chosen) return;
        setSaving(true); setSaveMsg('');
        logActivity('document_created', { caseId: chosen.id, label: template.title, ref: `tpl:${template.id}:${chosen.id}:${new Date().toDateString()}` });
        try {
            const blob = await buildDocx(text);
            const name = `${template.title.replace(/[^\p{L}\p{N}]+/gu, '_')}.docx`;
            const file = new File([blob], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            await uploadCaseFile(userId, chosen.id, null, file);
            await insertRow('case_entries', { case_id: chosen.id, user_id: userId, kind: 'event', title: `Vytvořen dokument: ${template.title}`.slice(0, 200), body: remaining.length ? `Ve vzoru zbývá doplnit: ${remaining.join(', ')}.` : 'Dokument vygenerován ze vzoru a uložen do souborů věci.', happened_on: new Date().toISOString().slice(0, 10) });
            setSaveMsg(`Uloženo do věci „${chosen.title}“ (soubor ${name}) a zapsáno do chronologie.`);
        } catch (e) { setSaveMsg(e instanceof Error ? e.message : 'Uložení se nepovedlo.'); }
        setSaving(false);
    }
    function print() {
        const w = window.open('', '_blank');
        if (!w) return;
        const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(template.title)}</title><pre style="font:14px/1.6 Georgia,serif;white-space:pre-wrap;max-width:44rem;margin:2rem auto">${esc(plainPreview(text))}</pre>`);
        w.document.close(); w.print();
    }

    return (
        <div className="space-y-4">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"><ArrowLeft size={15} /> Zpět do knihovny</button>
            <h2 className="text-xl font-bold text-slate-900">{template.title}</h2>
            <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
                <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-600">Věc, ze které se vyplní údaje
                        <select value={caseId} onChange={(e) => { setCaseId(e.target.value); setOverride({}); }} className={`${inputCls} mt-1 font-normal`}>
                            <option value="">Bez věci (jen údaje advokáta)</option>
                            {cases.map((c) => <option key={c.id} value={c.id}>{c.title}{c.client_name ? ` · ${c.client_name}` : ''}</option>)}
                        </select>
                    </label>
                    {fields.custom.map((k) => (
                        <label key={k} className="block text-xs font-semibold text-slate-600">{customLabel(k)}<input value={custom[k] ?? ''} onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))} className={`${inputCls} mt-1 font-normal`} /></label>
                    ))}
                    {fields.auto.filter((k) => !auto[k]?.trim()).map((k) => (
                        <label key={k} className="block text-xs font-semibold text-slate-600">{AUTO_FIELDS.find((f) => f.key === k)?.label ?? k}<span className="ml-1 font-normal text-slate-400">(není ve věci)</span><input value={override[k] ?? ''} onChange={(e) => setOverride((o) => ({ ...o, [k]: e.target.value }))} className={`${inputCls} mt-1 font-normal`} /></label>
                    ))}
                </div>
                <div className="min-w-0">
                    {template.note && <details className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><summary className="cursor-pointer font-bold">Co zkontrolovat před použitím</summary><p className="mt-1.5">{template.note}</p></details>}
                    {remaining.length > 0 && <p className="mb-2 rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">Zbývá doplnit: {remaining.join(', ')}. V textu jsou vidět jako {'{{pole}}'}.</p>}
                    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-white p-5 font-serif text-[14px] leading-relaxed text-slate-900">{plainPreview(text)}</pre>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void download()} className={primaryBtn}><Download size={15} /> Stáhnout Word (.docx)</button>
                        <button type="button" onClick={() => void copy()} className={ghostBtn}><Copy size={14} /> {copied ? 'Zkopírováno' : 'Kopírovat text'}</button>
                        <button type="button" onClick={print} className={ghostBtn}><Printer size={14} /> Tisk</button>
                        {chosen && <button type="button" onClick={() => void saveToCase()} disabled={saving} className={ghostBtn}>{saving ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />} Uložit do spisu věci</button>}
                    </div>
                    {saveMsg && <p role="status" className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900">{saveMsg}</p>}
                    <p className="mt-2 text-xs text-slate-500">Dokument se ukládá, jen když zvolíte „Uložit do spisu věci“ (jde o vybranou věc výše). Před odesláním ho vždy zkontrolujte.</p>
                </div>
            </div>
        </div>
    );
}

// Základní sada vzorů: přidá do knihovny advokáta kopie, které si může upravit
function StarterPack({ items, userId, onAdded }: { items: LawyerTemplate[]; userId: string; onAdded: () => Promise<void> }) {
    const have = new Set(items.filter((t) => t.user_id === userId && t.starter_id).map((t) => t.starter_id));
    const missing = STARTER_TEMPLATES.filter((t) => !have.has(t.id));
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    if (missing.length === 0) return null;
    async function add() {
        setBusy(true); setMsg('');
        const { error } = await supabase.from('lawyer_templates').insert(missing.map((t) => ({ user_id: userId, title: t.title, category: t.category, body: t.body, shared: false, starter_id: t.id, note: t.note })));
        setBusy(false);
        if (error) { setMsg(/starter_id|note|schema cache/i.test(error.message) ? 'Základní sada zatím není v databázi zapnutá (chybí spuštění souboru vzory.sql).' : error.message); return; }
        await onAdded();
    }
    return (
        <section className="rounded-2xl border border-indigo-200 bg-white p-5" aria-label="Základní sada vzorů">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Library size={18} className="text-indigo-700" aria-hidden="true" /> Základní sada vzorů ({missing.length})</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Hotové obecné vzory pro běžnou praxi: smlouva o právních službách, plné moci, informace o osobních údajích, souhlas s elektronickou komunikací, záznam o poradě, předávací protokol, předžalobní výzva, odstoupení od smlouvy, uznání dluhu a splátky, oznámení o zastoupení, žádost o informace a další. Pole se vyplní z věci a klienta a výstup je upravený Word s číslováním stránek a místy pro podpis.</p>
            <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">{missing.map((t) => <li key={t.id} className="truncate">• {t.title}</li>)}</ul>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">Vzory jsou obecné a slouží jako výchozí bod, nenahrazují právní posouzení konkrétní věci. U každého je poznámka „Co zkontrolovat před použitím“. Za použití vzoru a jeho obsah odpovídá advokát. Do vlastní knihovny se zkopírují a můžete je libovolně upravit.</p>
            <button type="button" onClick={() => void add()} disabled={busy} className={`${primaryBtn} mt-3`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Přidat do mé knihovny</button>
            {msg && <p role="alert" className="mt-2 text-sm text-rose-800">{msg}</p>}
        </section>
    );
}
