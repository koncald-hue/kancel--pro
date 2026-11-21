'use client';

import { useState } from 'react';
import { Archive, Loader2, Printer, X } from 'lucide-react';
import { DEFAULT_EXPORT, buildDossierHtml, downloadDossierZip, loadDefenseForExport, printDossier, type ExportOptions } from '@/lib/caseExport';
import { formatSize, type CaseDeadlineView } from '@/lib/caseFile';
import { ghostBtn, primaryBtn, type TabProps } from './caseUi';
import { useChannelKey, useDecryptedNames } from './useChannelKey';
import UpgradeNote from './UpgradeNote';
import { logCaseEvent } from '@/lib/audit';

// Předání spisu: úplný přehled k tisku nebo ZIP se souhrnem a očíslovanými přílohami
export default function CaseExportPanel({ item, bundle, deadlines, lawyer, onClose, fail }: { item: TabProps['item']; bundle: TabProps['bundle']; deadlines: CaseDeadlineView[]; lawyer: boolean; onClose: () => void; fail: TabProps['fail'] }) {
    const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT);
    const [busy, setBusy] = useState('');
    const channel = useChannelKey(item.id);
    const names = useDecryptedNames(bundle.files, channel.key);
    const total = bundle.files.reduce((s, f) => s + f.size, 0);
    const toggle = (key: keyof ExportOptions) => setOptions((o) => ({ ...o, [key]: !o[key] }));

    async function build() {
        const extra = options.defense ? await loadDefenseForExport(item.id) : { defense: null, laws: [] };
        return buildDossierHtml(item, bundle, deadlines, options, extra, names);
    }

    async function print() {
        setBusy('print');
        logCaseEvent(item.id, 'exportovano', 'cases', 'tisk spisu');
        try { if (!printDossier(await build())) fail(new Error('Prohlížeč zablokoval nové okno. Povolte vyskakovací okna.')); } catch (err) { fail(err); } finally { setBusy(''); }
    }

    async function zip() {
        setBusy('zip');
        logCaseEvent(item.id, 'exportovano', 'cases', options.files ? 'ZIP archiv včetně souborů' : 'ZIP archiv');
        try { await downloadDossierZip(item, await build(), bundle, options.files, (done, all) => setBusy(all ? `zip ${done}/${all}` : 'zip'), { key: channel.key, names }); } catch (err) { fail(err); } finally { setBusy(''); }
    }

    const allChecks: [keyof ExportOptions, string, string][] = [
        ['files', `Přiložit soubory ze spisu (${bundle.files.length}, ${formatSize(total)})`, 'Jen v ZIP archivu, očíslované jako přílohy.'],
        ['notes', 'Moje poznámky', 'Vypněte, pokud jsou jen pro vás.'],
        ['contacts', 'Kontakty', ''],
        ['defense', 'Podklad k obhajobě', 'Strategii a ověřenou judikaturu z karty Obrana, pokud je připravená.'],
    ];
    // Bezplatný účet: jen tisk souhrnu, bez archivu s přílohami
    const checks = lawyer ? allChecks : allChecks.filter(([key]) => key !== 'files');

    return (
        <section aria-label="Předání spisu" className="mt-4 rounded-2xl border border-indigo-300 bg-indigo-50/70 p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Předat spis úřadu nebo advokátovi</h2>
                    <p className="mt-1 text-sm text-slate-600">Vše v jednom kuse: přehledný souhrn spisu, časová osa, lhůty, seznam příloh a samotné soubory.</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1.5 text-slate-500 hover:bg-white cursor-pointer"><X size={18} /></button>
            </div>
            <fieldset className="mt-4 space-y-2.5">
                <legend className="sr-only">Co zahrnout</legend>
                {checks.map(([key, label, hint]) => (
                    <label key={key} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800">
                        <input type="checkbox" checked={options[key]} onChange={() => toggle(key)} className="mt-1 h-4 w-4 accent-indigo-800" />
                        <span>{label}{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span>
                    </label>
                ))}
            </fieldset>
            <div className="mt-5 flex flex-wrap gap-3">
                {lawyer && <button type="button" onClick={() => void zip()} disabled={!!busy} className={primaryBtn}>
                    {busy.startsWith('zip') ? <><Loader2 size={16} className="animate-spin" /> Připravuji{busy.includes('/') ? ` ${busy.slice(4)}` : ''}…</> : <><Archive size={16} /> Stáhnout kompletní spis (ZIP)</>}
                </button>}
                <button type="button" onClick={() => void print()} disabled={!!busy} className={lawyer ? ghostBtn : primaryBtn}>{busy === 'print' ? 'Připravuji…' : <><Printer size={15} /> Tisk / uložit jako PDF</>}</button>
            </div>
            {channel.locked && options.files && <p className="mt-3 rounded-lg bg-white p-3 text-xs text-indigo-950">Šifrované soubory od klienta se do archivu dostanou, jen když odemknete šifrování v záložce Klient. Jinak se přeskočí.</p>}
            {!lawyer && <div className="mt-4"><UpgradeNote>Archiv ZIP s očíslovanými přílohami a předání advokátovi jsou v balíčku pro advokáty.</UpgradeNote></div>}
            <p className="mt-3 text-xs text-slate-500">Soubory se stahují jen do vašeho zařízení. Nikam je neposíláme. Dále je předáte vy, např. e-mailem nebo datovou schránkou.</p>
        </section>
    );
}
