'use client';

import { useState } from 'react';
import { Download, FileText, Mail } from 'lucide-react';
import { buildManifest, isHttpsOrigin, type AddinKind } from '@/lib/officeManifest';
import { ghostBtn, inputCls } from '../situation/caseUi';

// Doplňky pro Word a Outlook: stažení manifestu a stručný postup instalace
export default function LawyerAddins() {
    const [origin, setOrigin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));
    const okOrigin = isHttpsOrigin(origin);
    function download(kind: AddinKind) {
        const xml = buildManifest(kind, origin, crypto.randomUUID());
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); a.download = `kancelar-${kind}.xml`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    const card = 'rounded-2xl border border-slate-200 bg-white p-5';
    return (
        <div className="max-w-3xl space-y-4">
            <section className={card}>
                <h2 className="text-lg font-bold text-slate-900">Doplňky pro Word a Outlook</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Pracujte s Kanceláří přímo v programech, ve kterých trávíte den. Ve Wordu uložíte rozepsaný dokument do spisu (při stejném názvu jako novou verzi), vložíte údaje spisu do hlavičky podání a zapíšete čas. V Outlooku uložíte e-mail i s přílohami do správného spisu jedním klepnutím, spis se navrhne podle klienta a spisové značky.</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">Jak na to: stáhněte si soubor (manifest) pro Word nebo Outlook a přidejte ho v daném programu v nabídce Doplňky, Moje doplňky, Nahrát můj doplněk. Stačí jednou, pak doplněk najdete na kartě Kancelář.</p>
                {!okOrigin && (
                    <div className="mt-3">
                        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950">Doplňky Office funguje jen na zabezpečené adrese (HTTPS). Tuto verzi Kanceláře otevíráte na adrese bez HTTPS, proto je stažení vypnuté. Na ostré adrese kanceláře bude fungovat hned.</p>
                        <label className="mt-2 block text-xs font-semibold text-slate-600">Adresa Kanceláře (jen pro vyzkoušení)
                            <input value={origin} onChange={(e) => setOrigin(e.target.value.trim())} className={`${inputCls} mt-1 max-w-sm font-normal`} aria-label="Adresa aplikace" />
                        </label>
                    </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={!okOrigin} onClick={() => download('word')} className={ghostBtn}><FileText size={14} /> Manifest pro Word <Download size={13} /></button>
                    <button type="button" disabled={!okOrigin} onClick={() => download('outlook')} className={ghostBtn}><Mail size={14} /> Manifest pro Outlook <Download size={13} /></button>
                </div>
            </section>
            <section className={card}>
                <h3 className="font-bold text-slate-900">Jak doplněk přidat</h3>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
                    <li><strong>Word:</strong> Vložit → Doplňky → Moje doplňky → Nahrát můj doplněk, vyberte stažený soubor. Podokno Kancelář se otevře z karty Domů.</li>
                    <li><strong>Outlook:</strong> Domů → Získat doplňky → Moje doplňky → Vlastní doplňky → Přidat z souboru. Doplněk pak uvidíte u otevřené zprávy.</li>
                    <li>V podokně se přihlaste svým účtem (i s druhým faktorem). Přihlášení platí jen v podokně Office.</li>
                    <li>Správce Microsoft 365 může doplněk nasadit celé kanceláři najednou stejným souborem.</li>
                </ol>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">Soubory a zápisy se ukládají do stejného spisu jako při práci v aplikaci. E-maily a dokumenty doplněk načítá jen na vaši výzvu klepnutím, nic se neodesílá samo. Pokud schránku v Kanceláři nemáte připojenou, doplněk Outlooku funguje i tak, protože čte zprávu přímo z Outlooku.</p>
            </section>
        </div>
    );
}
