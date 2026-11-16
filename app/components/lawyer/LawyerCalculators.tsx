'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, FilePlus2, Info, Loader2, Percent, Plus, Trash2 } from 'lucide-react';
import { loadCases, type LegalCase } from '@/lib/cases';
import { money, parseAmount, todayIso, type DraftLine } from '@/lib/billing';
import { createDraftInvoice } from '@/lib/invoiceDraft';
import { DPH_DEFAULT, PAUSAL_DEFAULT, UKONY, clampUprava, vypocet } from '@/lib/tarif';
import { EARLIEST, REPO_UPDATED, addDays, isIso, vypocetUroku, zakonnaSazba, type Splatka } from '@/lib/urok';
import { ghostBtn, inputCls, primaryBtn } from '../situation/caseUi';
import { useLawyer } from './LawyerGate';

const num = (v: string) => { const n = parseAmount(v); return n === null ? 0 : n; };
const dateCz = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ');
const label = 'block text-xs font-semibold text-slate-600';
// Datum jako RRRR-MM-DD nebo D. M. RRRR; neplatné vrátí null
const toIso = (t: string) => { const m = t.trim().match(/^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{4})$/); const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t.trim(); return isIso(iso) ? iso : null; };


type Tab = 'odmena' | 'urok';

// Kalkulačky pro peníze: odměna podle advokátního tarifu a zákonný úrok z prodlení. Výsledek jde jedním klikem do konceptu vyúčtování.
export default function LawyerCalculators() {
    const [tab, setTab] = useState<Tab>('odmena');
    const [cases, setCases] = useState<LegalCase[]>([]);
    const [preset, setPreset] = useState<{ case?: string; jistina?: string; splatnost?: string } | null>(null);
    // Předvyplnění z odkazu (věc, neuhrazená faktura po splatnosti): ?tab=urok&jistina=…&splatnost=…&case=…
    useEffect(() => {
        const q = new URLSearchParams(window.location.search);
        const t = window.setTimeout(() => {
            if (q.get('tab') === 'urok') setTab('urok');
            setPreset({ case: q.get('case') ?? undefined, jistina: q.get('jistina') ?? undefined, splatnost: q.get('splatnost') ?? undefined });
        }, 0);
        return () => window.clearTimeout(t);
    }, []);
    useEffect(() => { let alive = true; loadCases().then((c) => { if (alive) setCases(c); }).catch(() => undefined); return () => { alive = false; }; }, []);
    return (
        <div className="space-y-5">
            <div className="flex gap-1.5" role="tablist" aria-label="Kalkulačka">
                {([['odmena', 'Odměna podle tarifu', Calculator], ['urok', 'Úrok z prodlení', Percent]] as const).map(([id, name, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold cursor-pointer ${tab === id ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}><Icon size={14} aria-hidden="true" /> {name}</button>)}
            </div>
            {tab === 'odmena' ? <Reward key={`r-${preset?.case ?? ''}`} cases={cases} presetCase={preset?.case} /> : <Interest key={`i-${preset?.splatnost ?? ''}`} cases={cases} preset={preset} />}
        </div>
    );
}

function CaseSelect({ cases, value, onChange }: { cases: LegalCase[]; value: string; onChange: (id: string) => void }) {
    return <label className={label}>Věc pro vyúčtování (nepovinné)<select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mt-1 font-normal`}><option value="">Bez věci</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}{c.client_name ? ` · ${c.client_name}` : ''}</option>)}</select></label>;
}

function useDraft(cases: LegalCase[]) {
    const { userId } = useLawyer();
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function make(caseId: string, title: string, lines: DraftLine[]) {
        setBusy(true); setError('');
        try {
            const c = cases.find((x) => x.id === caseId);
            const id = await createDraftInvoice({ userId, title: c ? `${title} – ${c.title}` : title, caseId: c?.id ?? null, clientId: c?.client_id ?? null, lines });
            router.push(`/kancelar/faktury/${id}`);
        } catch (e) { setError(e instanceof Error ? e.message : 'Koncept se nepodařilo založit.'); setBusy(false); }
    }
    return { busy, error, make };
}

function Reward({ cases, presetCase }: { cases: LegalCase[]; presetCase?: string }) {
    const { access } = useLawyer();
    const [hodnota, setHodnota] = useState('100000');
    const [pocty, setPocty] = useState<Record<string, number>>({ '1a': 1, '1d': 1 });
    const [uprava, setUprava] = useState('100');
    const [osoby, setOsoby] = useState('1');
    const [pausal, setPausal] = useState(String(PAUSAL_DEFAULT));
    const [vydaje, setVydaje] = useState('0');
    const [dph, setDph] = useState(!!access.vat_payer);
    const [caseId, setCaseId] = useState(presetCase ?? '');
    const draft = useDraft(cases);

    const r = useMemo(() => vypocet({ hodnota: num(hodnota), pocty, upravaPct: num(uprava) || 100, osoby: Math.max(1, Math.floor(num(osoby) || 1)), pausal: num(pausal), vydaje: num(vydaje), platceDph: dph, dph: DPH_DEFAULT }), [hodnota, pocty, uprava, osoby, pausal, vydaje, dph]);
    const adj = clampUprava(num(uprava) || 100);

    function toInvoice() {
        const rate = dph ? DPH_DEFAULT : 0;
        const koef = r.uprava * r.osoby;
        const lines: DraftLine[] = [
            ...r.polozky.map((p) => ({ description: `Odměna podle advokátního tarifu: ${p.label}`, qty: p.pocet, unit: 'úkon', unit_price: Math.round(p.sazbaUkonu * koef * 100) / 100, vat_rate: rate })),
            ...(r.ukonu && r.pausal ? [{ description: 'Paušální náhrada hotových výdajů (§ 13 odst. 4 AT)', qty: r.ukonu, unit: 'úkon', unit_price: num(pausal), vat_rate: rate }] : []),
            ...(r.vydaje ? [{ description: 'Hotové výdaje', qty: 1, unit: 'ks', unit_price: r.vydaje, vat_rate: rate }] : []),
        ];
        void draft.make(caseId, 'Odměna podle advokátního tarifu', lines);
    }

    const setCount = (id: string, v: number) => setPocty((p) => ({ ...p, [id]: Math.max(0, Math.min(99, v)) }));

    return (
        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Zadání">
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className={label}>Tarifní hodnota (Kč)<input value={hodnota} onChange={(e) => setHodnota(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 font-normal`} /></label>
                    <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Sazba za 1 úkon (§ 7)</p><p className="text-xl font-bold">{money(r.sazbaPlna)}</p><p className="text-xs">polovina: {money(r.sazbaPlna / 2)}</p></div>
                </div>
                <p className="flex items-start gap-2 text-xs text-slate-500"><Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> Tarifní hodnotu určete podle § 8 a 9 vyhlášky (u peněžních plnění výše plnění). Kalkulačka počítá mimosmluvní odměnu, ze které se vychází i u náhrady nákladů řízení.</p>

                <div>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Úkony právní služby (§ 11)</h2>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {UKONY.map((u) => (
                            <li key={u.id} className="flex items-center gap-3 px-3 py-2">
                                <span className="min-w-0 flex-1 text-sm text-slate-800">{u.label}<span className="block text-[11px] text-slate-400">{u.hint}{u.half ? ' · polovina sazby' : ''}</span></span>
                                <span className="flex items-center gap-1">
                                    <button type="button" onClick={() => setCount(u.id, (pocty[u.id] ?? 0) - 1)} aria-label={`Ubrat: ${u.label}`} className="h-7 w-7 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">−</button>
                                    <input value={pocty[u.id] ?? 0} onChange={(e) => setCount(u.id, Math.floor(num(e.target.value)))} inputMode="numeric" aria-label={`Počet: ${u.label}`} className="h-7 w-11 rounded-lg border border-slate-300 text-center text-sm" />
                                    <button type="button" onClick={() => setCount(u.id, (pocty[u.id] ?? 0) + 1)} aria-label={`Přidat: ${u.label}`} className="h-7 w-7 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">+</button>
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-1.5 text-xs text-slate-500">Další úkony podle § 11 odst. 3 se posuzují jako nejbližší úkon, přidejte je jako ruční řádek ve vyúčtování.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <label className={label}>Úprava odměny (%)<input value={uprava} onChange={(e) => setUprava(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} /><span className="mt-1 block text-[11px] font-normal text-slate-500">§ 12 odst. 1 a 2: snížit nejvýše o polovinu, zvýšit až na trojnásobek{num(uprava) !== adj && num(uprava) ? ` (použito ${adj} %)` : ''}</span></label>
                    <label className={label}>Zastupované osoby<input value={osoby} onChange={(e) => setOsoby(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1 font-normal`} /><span className="mt-1 block text-[11px] font-normal text-slate-500">§ 12 odst. 4: za 2. osobu 80 %, 3. 60 %, 4. 40 %, další 20 %</span></label>
                    <label className={label}>Paušál výdajů na úkon (Kč)<input value={pausal} onChange={(e) => setPausal(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 font-normal`} /><span className="mt-1 block text-[11px] font-normal text-slate-500">§ 13 odst. 4: 450 Kč, nedohodnuto-li jinak</span></label>
                    <label className={label}>Další hotové výdaje (Kč)<input value={vydaje} onChange={(e) => setVydaje(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 font-normal`} /></label>
                    <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" checked={dph} onChange={(e) => setDph(e.target.checked)} className="h-4 w-4 accent-indigo-800" /> Plátce DPH ({DPH_DEFAULT} %)</label>
                </div>
            </section>

            <aside className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-5 lg:sticky lg:top-4 lg:self-start" aria-label="Výsledek">
                <h2 className="text-lg font-bold text-slate-900">Výsledek</h2>
                {r.ukonu === 0 ? <p className="text-sm text-slate-500">Zvolte aspoň jeden úkon.</p> : (
                    <dl className="space-y-1.5 text-sm">
                        {r.polozky.map((p) => <div key={p.id} className="flex justify-between gap-3"><dt className="min-w-0 text-slate-600"><span className="block truncate">{p.label}</span><span className="text-xs text-slate-400">{p.pocet} × {money(p.sazbaUkonu)}</span></dt><dd className="shrink-0 font-semibold text-slate-900">{money(p.castka)}</dd></div>)}
                        <div className="flex justify-between border-t border-slate-100 pt-1.5"><dt className="text-slate-600">Odměna za úkony</dt><dd className="font-semibold">{money(r.odmenaZaklad)}</dd></div>
                        {(r.uprava !== 1 || r.osoby !== 1) && <div className="flex justify-between text-xs text-slate-500"><dt>Úprava ×{r.uprava} · osoby ×{r.osoby}</dt><dd>{money(r.odmena)}</dd></div>}
                        <div className="flex justify-between"><dt className="text-slate-600">Paušál výdajů ({r.ukonu} úkonů)</dt><dd className="font-semibold">{money(r.pausal)}</dd></div>
                        {r.vydaje > 0 && <div className="flex justify-between"><dt className="text-slate-600">Hotové výdaje</dt><dd className="font-semibold">{money(r.vydaje)}</dd></div>}
                        <div className="flex justify-between border-t border-slate-100 pt-1.5"><dt className="text-slate-600">Základ</dt><dd className="font-semibold">{money(r.zaklad)}</dd></div>
                        {dph && <div className="flex justify-between"><dt className="text-slate-600">DPH {DPH_DEFAULT} %</dt><dd className="font-semibold">{money(r.dph)}</dd></div>}
                        <div className="flex justify-between border-t-2 border-slate-200 pt-2 text-base"><dt className="font-bold text-slate-900">Celkem</dt><dd className="font-bold text-indigo-900">{money(r.celkem)}</dd></div>
                    </dl>
                )}
                <CaseSelect cases={cases} value={caseId} onChange={setCaseId} />
                <button type="button" onClick={toInvoice} disabled={r.ukonu === 0 || draft.busy} className={`${primaryBtn} w-full justify-center`}>{draft.busy ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />} Vytvořit koncept vyúčtování</button>
                {draft.error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-900">{draft.error}</p>}
                <p className="text-[11px] leading-relaxed text-slate-500">Orientační výpočet podle vyhlášky č. 177/1996 Sb. (advokátní tarif). Před použitím zkontrolujte tarifní hodnotu a počet úkonů.</p>
            </aside>
        </div>
    );
}

function Interest({ cases, preset }: { cases: LegalCase[]; preset: { case?: string; jistina?: string; splatnost?: string } | null }) {
    const iso = preset?.splatnost && isIso(preset.splatnost) ? preset.splatnost : '';
    const [jistina, setJistina] = useState(preset?.jistina && Number(preset.jistina) > 0 ? preset.jistina : '100000');
    const [splatnost, setSplatnost] = useState(iso ? dateCz(iso) : '');
    const [doDne, setDoDne] = useState(todayIso());
    const [splatky, setSplatky] = useState<{ date: string; amount: string }[]>([]);
    const [smluvni, setSmluvni] = useState('');
    const [caseId, setCaseId] = useState(preset?.case ?? '');
    const draft = useDraft(cases);

    // Splatnost a datum zaplacení se píšou jako RRRR-MM-DD nebo D. M. RRRR
    const due = toIso(splatnost); const end = toIso(doDne);
    const info = due ? zakonnaSazba(due) : null;
    const customRate = smluvni.trim() ? num(smluvni) : null;
    const rate = customRate ?? info?.rocni ?? null;
    const partials: Splatka[] = splatky.flatMap((s) => { const d = toIso(s.date); return d && num(s.amount) > 0 ? [{ date: d, amount: num(s.amount) }] : []; });

    const result = due && end && end > due && rate !== null ? vypocetUroku({ jistina: num(jistina), splatnost: due, do: end, splatky: partials, sazbaPct: rate }) : null;

    let problem = '';
    if (!splatnost.trim()) problem = 'Zadejte datum splatnosti.';
    else if (!due) problem = 'Datum splatnosti zadejte ve tvaru D. M. RRRR (rok čtyřmístně).';
    else if (!end) problem = 'Datum zaplacení nebo výpočtu zadejte ve tvaru D. M. RRRR.';
    else if (end <= due) problem = 'Datum výpočtu musí být po splatnosti.';
    else if (rate === null) problem = `Pro prodlení před ${dateCz(EARLIEST)} se zákonná sazba nepočítá (nařízení vlády č. 351/2013 Sb.). Zadejte sazbu ručně.`;

    function toInvoice() {
        if (!result || !due || !end) return;
        void draft.make(caseId, 'Úrok z prodlení', [{ description: `Úrok z prodlení ${String(result.sazbaPct).replace('.', ',')} % p.a. z jistiny ${money(num(jistina))} za ${result.dnuCelkem} dní (${dateCz(addDays(due, 1))} až ${dateCz(end)})`, qty: 1, unit: 'paušál', unit_price: result.urok, vat_rate: 0 }]);
    }

    return (
        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Zadání">
                <div className="grid gap-3 sm:grid-cols-3">
                    <label className={label}>Dlužná částka (Kč)<input value={jistina} onChange={(e) => setJistina(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 font-normal`} /></label>
                    <label className={label}>Splatnost<input value={splatnost} onChange={(e) => setSplatnost(e.target.value)} placeholder="např. 31. 3. 2025" inputMode="numeric" aria-invalid={!!splatnost && !due} className={`${inputCls} mt-1 font-normal`} /></label>
                    <label className={label}>Do dne (zaplacení / výpočet)<input value={doDne} onChange={(e) => setDoDne(e.target.value)} placeholder="D. M. RRRR" inputMode="numeric" className={`${inputCls} mt-1 font-normal`} /></label>
                </div>
                <div>
                    <div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Částečné úhrady</h2><button type="button" onClick={() => setSplatky((l) => [...l, { date: '', amount: '' }])} className={ghostBtn}><Plus size={13} /> Přidat úhradu</button></div>
                    {splatky.length === 0 ? <p className="mt-1.5 text-xs text-slate-500">Žádné. Zadejte, pokud dlužník část uhradil. Jistina se sníží od dalšího dne.</p> : (
                        <ul className="mt-2 space-y-2">{splatky.map((s, i) => (
                            <li key={i} className="flex items-center gap-2"><input value={s.date} onChange={(e) => setSplatky((l) => l.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} placeholder="D. M. RRRR" aria-label="Datum úhrady" className={inputCls} /><input value={s.amount} onChange={(e) => setSplatky((l) => l.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder="Částka" inputMode="decimal" aria-label="Zaplacená částka" className={inputCls} /><button type="button" onClick={() => setSplatky((l) => l.filter((_, j) => j !== i))} aria-label="Odebrat úhradu" className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={15} /></button></li>
                        ))}</ul>
                    )}
                </div>
                <label className={label}>Vlastní roční sazba (%), např. smluvní úrok (nepovinné)<input value={smluvni} onChange={(e) => setSmluvni(e.target.value)} inputMode="decimal" placeholder="Prázdné = zákonná sazba" className={`${inputCls} mt-1 max-w-xs font-normal`} /></label>
                {info && customRate === null && (
                    <div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">
                        <p className="font-semibold">Zákonná sazba: {String(info.rocni).replace('.', ',')} % ročně</p>
                        <p className="mt-0.5 text-xs">Prodlení vzniklo {dateCz(info.startProdleni)}, rozhoduje repo sazba ČNB k {dateCz(info.pololeti)}: {String(info.repo).replace('.', ',')} % + 8 procentních bodů (§ 2 odst. 1 nařízení vlády č. 351/2013 Sb.). Sazba platí po celou dobu prodlení.</p>
                    </div>
                )}
            </section>

            <aside className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-5 lg:sticky lg:top-4 lg:self-start" aria-label="Výsledek">
                <h2 className="text-lg font-bold text-slate-900">Výsledek</h2>
                {!result ? <p className="text-sm text-slate-500">{problem}</p> : (
                    <>
                        <dl className="space-y-1.5 text-sm">
                            {result.radky.map((x, i) => <div key={i} className="flex justify-between gap-3"><dt className="min-w-0 text-slate-600"><span className="block">{dateCz(x.od)} – {dateCz(x.do)}</span><span className="text-xs text-slate-400">{x.dnu} dní z {money(x.jistina)}</span></dt><dd className="shrink-0 font-semibold">{money(x.urok)}</dd></div>)}
                            <div className="flex justify-between border-t border-slate-100 pt-1.5"><dt className="text-slate-600">Dní prodlení</dt><dd className="font-semibold">{result.dnuCelkem}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Sazba</dt><dd className="font-semibold">{String(result.sazbaPct).replace('.', ',')} % p.a.</dd></div>
                            {result.zaplaceno > 0 && <div className="flex justify-between"><dt className="text-slate-600">Již uhrazeno z jistiny</dt><dd className="font-semibold">{money(result.zaplaceno)}</dd></div>}
                            <div className="flex justify-between border-t-2 border-slate-200 pt-2 text-base"><dt className="font-bold text-slate-900">Úrok z prodlení</dt><dd className="font-bold text-indigo-900">{money(result.urok)}</dd></div>
                            <div className="flex justify-between text-xs text-slate-500"><dt>Dále denně (ze zbývající jistiny)</dt><dd>{money((result.zbyvaJistina * result.sazbaPct / 100) / 365)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-600">Zbývá jistina + úrok</dt><dd className="font-semibold">{money(result.zbyvaJistina + result.urok)}</dd></div>
                        </dl>
                        <CaseSelect cases={cases} value={caseId} onChange={setCaseId} />
                        <button type="button" onClick={toInvoice} disabled={draft.busy || result.urok <= 0} className={`${primaryBtn} w-full justify-center`}>{draft.busy ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />} Vytvořit koncept vyúčtování</button>
                        {draft.error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-900">{draft.error}</p>}
                    </>
                )}
                <p className="text-[11px] leading-relaxed text-slate-500">Počítá se každý den po splatnosti až do dne zaplacení včetně, rok má 365 dní. Sazby repo vycházejí z historie ČNB (aktualizováno {dateCz(REPO_UPDATED)}); u prodlení v dalším pololetí se sazba doplní po rozhodnutí ČNB. Orientační výpočet, vždy ho ověřte.</p>
            </aside>
        </div>
    );
}
