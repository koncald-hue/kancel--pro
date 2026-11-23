'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Megaphone, Search, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { inputCls, primaryBtn, ghostBtn } from '../situation/caseUi';
import { DIRECTORY_AREAS, DIRECTORY_REGIONS, PARTNER_REPLY_DAYS } from '@/lib/directory';
import type { LawyerAccess } from '@/lib/lawyer';

type Dir = { directory_listed?: boolean; directory_areas?: string[]; directory_regions?: string[]; directory_consult?: string; directory_bio?: string; job_code?: string | null };
const STUDUJPRAVO = 'https://studujpravo.cz';

// Noví klienti ze Studuj právo: vysvětlení, jak to funguje, nastavení zobrazení v katalogu a kód pro inzerci zdarma.
export default function DirectoryCard({ access }: { access: LawyerAccess }) {
    const a = access as LawyerAccess & Dir;
    // Výchozí stav je „zobrazovat“ (všichni advokáti jsou v katalogu, dokud si to nevypnou)
    const [listed, setListed] = useState(a.directory_listed !== false);
    const [areas, setAreas] = useState<string[]>(a.directory_areas ?? []);
    const [regions, setRegions] = useState<string[]>(a.directory_regions ?? []);
    const [consult, setConsult] = useState(a.directory_consult ?? '');
    const [bio, setBio] = useState(a.directory_bio ?? '');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [jobCode, setJobCode] = useState(a.job_code ?? '');
    const [copied, setCopied] = useState(false);
    const profileOk = access.verification_status === 'verified';

    const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

    async function save(nextListed = listed) {
        setMsg('');
        setBusy(true);
        const { error } = await supabase.rpc('save_directory', { p_listed: nextListed, p_areas: areas, p_regions: regions, p_consult: consult, p_bio: bio });
        setBusy(false);
        if (error) { setMsg(/save_directory|find the function/i.test(error.message) ? 'Katalog ještě není zapnutý v databázi (chybí spuštění 20261123_35_katalog-advokatu.sql).' : error.message); return; }
        setListed(nextListed);
        setMsg(nextListed ? 'Uloženo. Jste v katalogu na Studuj právo (změna se tam projeví do pár minut).' : 'Uloženo. V katalogu nejste a nové poptávky ze Studuj právo vám nepřijdou.');
    }

    async function getCode() {
        const { data, error } = await supabase.rpc('ensure_job_code');
        if (error) { setMsg(/ensure_job_code|find the function/i.test(error.message) ? 'Kód ještě není zapnutý v databázi (chybí spuštění 20261123_35_katalog-advokatu.sql).' : error.message); return; }
        setJobCode(String(data ?? ''));
    }

    const chip = (on: boolean) => `cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'}`;

    return (
        <>
            <section id="klienti" className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Noví klienti ze Studuj právo">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><UserPlus size={18} className="text-indigo-800" aria-hidden="true" /> Noví klienti ze Studuj právo</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Na studujpravo.cz se lidé ptají v bezplatné právní poradně. Když potřebují advokáta, ukážeme jim katalog advokátů z jejich oboru a kraje. Jste v něm automaticky (pokud jste advokát s vyplněným profilem) a je to součást předplatného. Nechcete? Zobrazení si níže vypnete.</p>

                <ol className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                        ['1', 'Jste v katalogu', 'Použije se váš profil. Vyberte obory a kraje, ať vás najdou ti správní lidé; bez výběru se ukazujete všude.'],
                        ['2', 'Člověk si vybere vás', 'V katalogu jsou advokáti v náhodném pořadí. Zájemce si sám vybere a pošle vám popis věci.'],
                        ['3', 'Přijmete, nebo odmítnete', `Poptávka přijde do Poptávek a e-mailem. Přijetím z ní jedním klikem vznikne klient a spis. Rozhodněte do ${PARTNER_REPLY_DAYS} dnů.`],
                    ].map(([n, t, d]) => (
                        <li key={n} className="rounded-xl bg-slate-50 p-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">{n}</span>
                            <p className="mt-2 text-sm font-bold text-slate-900">{t}</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">{d}</p>
                        </li>
                    ))}
                </ol>
                <p className="mt-3 text-xs leading-relaxed text-slate-500"><strong>Za poptávky nic neplatíte</strong> a nikomu neplatíte podíl z odměny. Studuj právo vás nedoporučuje ani nijak neřadí, jen ukazuje katalog. Cenu služeb si domluvíte přímo s klientem, jako u každé jiné poptávky.</p>

                {access.profession === 'jiny' ? (
                    <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Katalog na Studuj právo je jen pro advokáty zapsané u ČAK. V profilu máte uvedeno „Jiný právník“, proto se v něm nezobrazujete.</p>
                ) : !profileOk ? (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Nejdřív vyplňte profil (záložka Účet a fakturace). V katalogu se ukazuje vaše jméno, evidenční číslo ČAK, město a fotka z profilu.</p>
                ) : (
                    <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900">
                            <input type="checkbox" checked={listed} onChange={(e) => void save(e.target.checked)} disabled={busy} className="h-5 w-5 accent-indigo-700" />
                            Zobrazovat mě v katalogu advokátů na Studuj právo
                        </label>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Obory, ve kterých chcete nové klienty <span className="font-normal text-slate-500">(bez výběru: všechny)</span></p>
                            <div className="mt-2 flex flex-wrap gap-2">{DIRECTORY_AREAS.map((x) => <button key={x.id} type="button" aria-pressed={areas.includes(x.id)} onClick={() => setAreas((l) => toggle(l, x.id))} className={chip(areas.includes(x.id))}>{x.label}</button>)}</div>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Kraje, odkud klienty berete <span className="font-normal text-slate-500">(bez výběru: celá ČR)</span></p>
                            <div className="mt-2 flex flex-wrap gap-2">{DIRECTORY_REGIONS.map((r) => <button key={r} type="button" aria-pressed={regions.includes(r)} onClick={() => setRegions((l) => toggle(l, r))} className={chip(regions.includes(r))}>{r}</button>)}</div>
                        </div>
                        <label className="block text-sm font-semibold text-slate-800">První konzultace (nepovinné)
                            <input value={consult} onChange={(e) => setConsult(e.target.value)} maxLength={120} className={`${inputCls} mt-1 font-normal`} placeholder="např. 30 minut zdarma, nebo 1 500 Kč za hodinu" />
                        </label>
                        <label className="block text-sm font-semibold text-slate-800">Krátce o vás (nepovinné)
                            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} rows={3} className={`${inputCls} mt-1 font-normal`} placeholder="S čím nejčastěji pomáháte, jazyky, zda jezdíte i mimo sídlo…" />
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => void save()} disabled={busy} className={primaryBtn}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Uložit</button>
                            {listed && <a href={`${STUDUJPRAVO}/advokati`} target="_blank" rel="noopener noreferrer" className={ghostBtn}><Search size={15} /> Zobrazit katalog <ExternalLink size={13} /></a>}
                        </div>
                    </div>
                )}
                {msg && <p className="mt-3 text-sm font-medium text-slate-700" role="status">{msg}</p>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Inzerce na Studuj právo">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Megaphone size={18} className="text-indigo-800" aria-hidden="true" /> Hledáte koncipienta nebo asistenta? Topování zdarma</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Na Studuj právo čtou nabídky práce studenti a absolventi práv. Inzerovat tam může každý zdarma; s předplatným Kanceláře Pro máte zdarma i topování (14 dní nahoře v seznamu, jinak 399 Kč). Při přidání nabídky zaškrtněte topování a vložte tento kód.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {jobCode ? (
                        <>
                            <code className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm font-bold text-slate-900">{jobCode}</code>
                            <button type="button" onClick={() => { void navigator.clipboard?.writeText(jobCode); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className={ghostBtn}><Copy size={15} /> {copied ? 'Zkopírováno' : 'Kopírovat'}</button>
                            <a href={`${STUDUJPRAVO}/nabidky-prace/pridat?kod=${encodeURIComponent(jobCode)}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}>Přidat nabídku <ExternalLink size={13} /></a>
                        </>
                    ) : <button type="button" onClick={() => void getCode()} className={primaryBtn}>Získat kód pro inzerci</button>}
                </div>
            </section>
        </>
    );
}
