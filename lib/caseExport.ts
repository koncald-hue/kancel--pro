import { supabase } from './supabase';
import type { CaseBundle, CaseDeadlineView, CaseFile } from './caseFile';
import { formatSize } from './caseFile';
import type { LegalCase } from './cases';
import { OFFENSES_DATABASE } from '@/app/data/offenses';
import { decryptBytes } from './e2ee';

export type ExportOptions = { defense: boolean; notes: boolean; contacts: boolean; files: boolean };
export const DEFAULT_EXPORT: ExportOptions = { defense: false, notes: true, contacts: true, files: true };

type Defense = {
    classification?: string; must_prove?: string[]; angles?: { title: string; explanation: string; check: string }[]; procedural_checks?: string[];
    evidence?: string[]; plan?: { step: string; when: string; detail: string }[]; risks?: string[]; judikatura?: { id: string; why: string }[];
};
type Law = { id: string; court: string; ref: string; decided_on: string | null; holding: string; url: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cz = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('cs-CZ') : '');
const ul = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');

// Příloha č. N: pořadí souborů ve spisu, stejné v přehledu i v ZIP archivu
export function attachmentsOf(bundle: CaseBundle, names: Record<string, string> = {}) {
    const nameOf = (f: CaseFile) => (f.enc ? (names[f.id] ?? 'zasifrovany-soubor') : f.name);
    const folderName = (f: CaseFile) => bundle.folders.find((x) => x.id === f.folder_id)?.name ?? '';
    return [...bundle.files]
        .sort((a, b) => folderName(a).localeCompare(folderName(b), 'cs') || a.created_at.localeCompare(b.created_at))
        .map((file, i) => ({ n: i + 1, file, name: nameOf(file), folder: folderName(file), zipPath: `prilohy/${String(i + 1).padStart(2, '0')}-${nameOf(file).replace(/[\\/:*?"<>|]+/g, '_')}` }));
}

export async function loadDefenseForExport(caseId: string): Promise<{ defense: Defense | null; laws: Law[] }> {
    const { data, error } = await supabase.from('cases').select('defense').eq('id', caseId).maybeSingle();
    const defense = error ? null : ((data?.defense as Defense | null) ?? null);
    const ids = defense?.judikatura?.map((j) => j.id) ?? [];
    if (!ids.length) return { defense, laws: [] };
    const { data: laws } = await supabase.from('case_law').select('id, court, ref, decided_on, holding, url').in('id', ids).eq('verified', true);
    return { defense, laws: (laws ?? []) as Law[] };
}

// Úplný přehled spisu k předání úřadu nebo advokátovi (tisk do PDF i součást ZIP archivu)
export function buildDossierHtml(item: LegalCase, bundle: CaseBundle, deadlines: CaseDeadlineView[], options: ExportOptions, extra: { defense: Defense | null; laws: Law[] } = { defense: null, laws: [] }, names: Record<string, string> = {}): string {
    const attachments = attachmentsOf(bundle, names);
    const events = bundle.entries.filter((e) => e.kind === 'event').sort((a, b) => (a.happened_on ?? a.created_at.slice(0, 10)).localeCompare(b.happened_on ?? b.created_at.slice(0, 10)));
    const notes = bundle.entries.filter((e) => e.kind === 'note');
    const offenses = item.offense_ids.flatMap((id) => OFFENSES_DATABASE.find((o) => o.id === id) ?? []);
    const sections: { title: string; html: string }[] = [];
    const add = (title: string, html: string) => { if (html) sections.push({ title, html }); };

    add('Popis spisu', [item.situation && `<p>${esc(item.situation)}</p>`, item.summary && `<p>${esc(item.summary)}</p>`].filter(Boolean).join(''));
    add('Související ustanovení', offenses.length ? `<ul>${offenses.map((o) => `<li><b>${esc(o.title)}</b>, ${esc(o.lawSection)}<br><small>${esc(o.sanction)}</small></li>`).join('')}</ul>` : '');
    add('Časová osa', events.length ? `<table>${events.map((e) => `<tr><td class="d">${cz(e.happened_on ?? e.created_at.slice(0, 10))}</td><td><b>${esc(e.title)}</b>${e.body ? `<br><small>${esc(e.body)}</small>` : ''}</td></tr>`).join('')}</table>` : '');
    add('Lhůty a termíny', deadlines.length ? `<table>${deadlines.map((d) => `<tr><td class="d">${cz(d.iso)}</td><td>${esc(d.title)}${d.done ? ' (splněno)' : ''}<br><small>${d.source === 'law' ? 'zákonná lhůta' : 'vlastní termín'}</small></td></tr>`).join('')}</table>` : '');
    add('Postup a splněné kroky', item.steps.length ? `<ul class="check">${item.steps.map((s) => `<li>${s.done ? '☑' : '☐'} ${esc(s.text)}</li>`).join('')}</ul>` : '');

    if (options.defense && extra.defense) {
        const d = extra.defense;
        const parts = [
            d.classification && `<p>${esc(d.classification)}</p>`,
            d.must_prove?.length ? `<h3>Co musí prokázat druhá strana</h3>${ul(d.must_prove)}` : '',
            d.angles?.length ? `<h3>Možné argumenty obrany</h3><ul>${d.angles.map((a) => `<li><b>${esc(a.title)}</b>. ${esc(a.explanation)}${a.check ? `<br><small>Ověřit: ${esc(a.check)}</small>` : ''}</li>`).join('')}</ul>` : '',
            d.procedural_checks?.length ? `<h3>Formální body ke kontrole</h3>${ul(d.procedural_checks)}` : '',
            d.plan?.length ? `<h3>Plánovaný postup</h3><ol>${d.plan.map((p) => `<li><b>${esc(p.step)}</b>${p.when ? ` (${esc(p.when)})` : ''}<br><small>${esc(p.detail)}</small></li>`).join('')}</ol>` : '',
            d.risks?.length ? `<h3>Rizika</h3>${ul(d.risks)}` : '',
            extra.laws.length ? `<h3>Ověřená judikatura</h3><ul>${extra.laws.map((l) => `<li><b>${esc(l.court)}, ${esc(l.ref)}</b>${l.decided_on ? ` (${cz(l.decided_on)})` : ''}<br><small>${esc(l.holding)}${l.url ? ` · ${esc(l.url)}` : ''}</small></li>`).join('')}</ul>` : '',
        ].filter(Boolean).join('');
        add('Podklad k obhajobě (orientační)', parts ? `${parts}<p><small>Automaticky vytvořený orientační podklad, nikoli právní posudek.</small></p>` : '');
    }

    if (options.contacts) add('Kontakty', bundle.contacts.length ? `<table>${bundle.contacts.map((c) => `<tr><td><b>${esc(c.name)}</b><br><small>${esc(c.role)}</small></td><td>${esc([c.email, c.phone].filter(Boolean).join(', '))}${c.note ? `<br><small>${esc(c.note)}</small>` : ''}</td></tr>`).join('')}</table>` : '');
    if (options.notes) add('Poznámky', notes.length ? notes.map((n) => `<p><b>${esc(n.title)}</b>${n.body ? `<br>${esc(n.body)}` : ''}</p>`).join('') : '');
    add('Seznam příloh', attachments.length ? `<table>${attachments.map((a) => `<tr><td class="d">Příloha č. ${a.n}</td><td><b>${esc(a.name)}</b><br><small>${[a.folder, cz(a.file.created_at), formatSize(a.file.size)].filter(Boolean).map(esc).join(' · ')}</small></td></tr>`).join('')}</table>` : '');

    const meta = [
        item.reference && `<tr><td class="d">Spisová značka / č. j.</td><td>${esc(item.reference)}</td></tr>`,
        item.authority && `<tr><td class="d">Úřad / soud</td><td>${esc(item.authority)}</td></tr>`,
        item.client_name && `<tr><td class="d">Klient / dotčená osoba</td><td>${esc(item.client_name)}</td></tr>`,
        `<tr><td class="d">Založeno</td><td>${cz(item.created_at)}</td></tr>`,
        `<tr><td class="d">Vytištěno</td><td>${new Date().toLocaleDateString('cs-CZ')}</td></tr>`,
    ].filter(Boolean).join('');

    return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${esc(item.title)}: spis</title>
<style>@page{margin:18mm}body{font:14px/1.55 Georgia,'Times New Roman',serif;color:#111;max-width:780px;margin:32px auto;padding:0 18px}h1{font-size:26px;margin:0 0 6px}h2{font-size:17px;margin:26px 0 8px;border-bottom:1px solid #bbb;padding-bottom:4px;break-after:avoid}h3{font-size:14px;margin:14px 0 4px}table{border-collapse:collapse;width:100%}td{padding:4px 10px 4px 0;vertical-align:top}td.d{white-space:nowrap;width:150px;color:#333}small{color:#555}ul,ol{padding-left:20px;margin:6px 0}ul.check{list-style:none;padding-left:0}p{margin:6px 0}.cover{border:1px solid #bbb;padding:18px 20px;margin-bottom:8px}.toc{font-size:13px;color:#333}</style></head><body>
<div class="cover"><small>SPIS</small><h1>${esc(item.title)}</h1><table>${meta}</table></div>
<p class="toc"><b>Obsah:</b> ${sections.map((s, i) => `${i + 1}. ${esc(s.title)}`).join(' · ')}</p>
${sections.map((s, i) => `<h2>${i + 1}. ${esc(s.title)}</h2>${s.html}`).join('\n')}
<p><small>Spis vytvořen v aplikaci Kancelář. Údaje zadal uživatel. Informace nenahrazují právní službu.</small></p>
</body></html>`;
}

export function printDossier(html: string): boolean {
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    return true;
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'spis';

// ZIP: souhrn + všechny soubory ze spisu očíslované jako přílohy
export async function downloadDossierZip(item: LegalCase, html: string, bundle: CaseBundle, includeFiles: boolean, onProgress: (done: number, total: number) => void, channel: { key: CryptoKey | null; names: Record<string, string> } = { key: null, names: {} }) {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('00-souhrn-spisu.html', html);
    const attachments = includeFiles ? attachmentsOf(bundle, channel.names) : [];
    const skipped: string[] = [];
    let done = 0;
    onProgress(0, attachments.length);
    for (const a of attachments) {
        // Šifrované soubory se dešifrují u vás v prohlížeči; bez odemčeného šifrování se přeskočí
        if (a.file.enc && !channel.key) { skipped.push(a.name); onProgress(++done, attachments.length); continue; }
        const { data, error } = await supabase.storage.from('case-files').download(a.file.path);
        if (error || !data) throw new Error(`Soubor „${a.name}“ se nepodařilo stáhnout.`);
        if (a.file.enc && channel.key) zip.file(a.zipPath, await decryptBytes(channel.key, new Uint8Array(await data.arrayBuffer())));
        else zip.file(a.zipPath, data);
        onProgress(++done, attachments.length);
    }
    if (skipped.length) zip.file('POZNAMKA-zasifrovane-soubory.txt', `Tyto šifrované soubory nejsou v archivu, protože bylo zamčené šifrování:\n${skipped.join('\n')}\n`);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spis-${slug(item.title)}.zip`;
    link.click();
    URL.revokeObjectURL(url);
}

