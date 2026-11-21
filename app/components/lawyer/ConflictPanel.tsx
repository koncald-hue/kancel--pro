'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { loadConflictPool, firmConflicts, type FirmHit } from '@/lib/conflictData';
import { findConflicts, KIND_LABEL, SEVERITY_LABEL, type Hit, type Party, type PoolEntry } from '@/lib/conflicts';

const TONE: Record<Hit['severity'], string> = { high: 'border-rose-300 bg-rose-50 text-rose-950', medium: 'border-amber-300 bg-amber-50 text-amber-950', low: 'border-slate-200 bg-slate-50 text-slate-700' };
const WHY = { ico: 'stejné IČO', email: 'stejný e-mail', jmeno: 'stejné jméno', podobne: 'podobné jméno' } as const;

// Výsledek kontroly střetu zájmů pro zadané strany. Vlastní data i shody u kolegů (bez detailů).
export default function ConflictPanel({ parties, role, compact = false }: { parties: Party[]; role: 'klient' | 'protistrana'; compact?: boolean }) {
    const [pool, setPool] = useState<PoolEntry[] | null>(null);
    const [firm, setFirm] = useState<{ hits: FirmHit[]; available: boolean } | null>(null);
    const key = JSON.stringify(parties.map((p) => [p.name.trim(), p.ico ?? '', p.email ?? '']));
    useEffect(() => { let a = true; loadConflictPool().then((p) => { if (a) setPool(p); }).catch(() => { if (a) setPool([]); }); return () => { a = false; }; }, []);
    useEffect(() => {
        const ps = parties.filter((p) => p.name.trim().length >= 4 || (p.ico ?? '').replace(/\D/g, '').length >= 6);
        if (!ps.length) { const t = window.setTimeout(() => setFirm(null), 0); return () => window.clearTimeout(t); }
        let a = true;
        const t = window.setTimeout(() => { firmConflicts(ps.map((p) => p.name.trim()), ps.map((p) => p.ico ?? '')).then((r) => { if (a) setFirm(r); }).catch(() => { if (a) setFirm({ hits: [], available: false }); }); }, 450);
        return () => { a = false; window.clearTimeout(t); };
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

    const hits = useMemo(() => {
        if (!pool) return [];
        return parties.filter((p) => p.name.trim().length >= 3 || (p.ico ?? '').replace(/\D/g, '').length >= 6).flatMap((p) => findConflicts(p, role, pool).map((h) => ({ party: p, hit: h })));
    }, [pool, key, role]); // eslint-disable-line react-hooks/exhaustive-deps
    const active = parties.some((p) => p.name.trim().length >= 3 || (p.ico ?? '').replace(/\D/g, '').length >= 6);
    if (!active) return null;
    if (!pool) return <p className="text-xs text-slate-500" role="status">Kontroluji střet zájmů…</p>;

    const firmHits = firm?.hits ?? [];
    const worst = hits[0]?.hit.severity ?? (firmHits.some((f) => (role === 'protistrana' ? f.kind === 'klient' : f.kind === 'protistrana')) ? 'high' : null);
    return (
        <section aria-label="Kontrola střetu zájmů" className="space-y-2">
            {hits.length === 0 && firmHits.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-emerald-800"><CheckCircle2 size={13} aria-hidden="true" /> Ve vašich klientech, protistranách ani spisech nic nenalezeno{firm?.available === false ? '' : ' (včetně kolegů v kanceláři)'}.</p>
            ) : (
                <>
                    {worst === 'high' && <p role="alert" className="flex items-center gap-1.5 text-sm font-bold text-rose-800"><ShieldAlert size={15} aria-hidden="true" /> Pozor, možný střet zájmů. Před převzetím spisu ho posuďte.</p>}
                    {hits.slice(0, compact ? 3 : 12).map(({ party, hit }, i) => (
                        <div key={i} className={`rounded-xl border p-3 text-sm ${TONE[hit.severity]}`}>
                            <p className="flex flex-wrap items-center gap-2"><AlertTriangle size={14} aria-hidden="true" /><strong>{SEVERITY_LABEL[hit.severity]}</strong><span>{party.name} ↔ <strong>{hit.entry.name}</strong> ({WHY[hit.why]}, {hit.score} %)</span></p>
                            <p className="mt-0.5 text-xs">V kanceláři: {KIND_LABEL[hit.entry.kind]}{hit.entry.caseTitle ? <> ve spisu <Link href={`/kancelar/veci/${hit.entry.caseId}`} className="underline">{hit.entry.caseTitle}</Link>{hit.entry.closed ? ' (uzavřená)' : ''}</> : ''}.</p>
                        </div>
                    ))}
                    {firmHits.map((f, i) => (
                        <div key={`f${i}`} className={`rounded-xl border p-3 text-sm ${(role === 'protistrana' ? f.kind === 'klient' : f.kind === 'protistrana') ? TONE.high : TONE.low}`}>
                            <p><strong>Kolega ve vaší kanceláři</strong> eviduje „{f.term}“ jako {f.kind === 'klient' ? 'klienta' : 'protistranu'}{f.n > 1 ? ` (${f.n}×)` : ''}. Podrobnosti Kancelář nesdílí, domluvte se s kolegou.</p>
                        </div>
                    ))}
                </>
            )}
            {firm?.available === false && <p className="flex items-start gap-1.5 text-xs text-slate-500"><Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> Kontrola napříč kanceláří se zapne po spuštění migrace 20261118_13. Zatím se kontrolují jen vaše data.</p>}
            <p className="text-xs leading-relaxed text-slate-500">Kontrola je pomůcka, nenahrazuje vaše posouzení podle stavovských předpisů. Porovnání se děje ve vašem prohlížeči, jména se neposílají nikam mimo databázi kanceláře a do AI.</p>
        </section>
    );
}
