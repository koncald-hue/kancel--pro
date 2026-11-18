'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, File as FileIcon, FileImage, FileText, Folder, FolderPlus, Lock, Trash2, Upload } from 'lucide-react';
import { DEFAULT_FOLDERS, deleteRow, formatSize, insertRow, openCaseFile, removeCaseFile, updateRow, uploadCaseFile, type CaseFolder } from '@/lib/caseFile';
import { ghostBtn, inputCls, primaryBtn, shortDate, type TabProps } from './caseUi';
import { useChannelKey, useDecryptedNames } from './useChannelKey';
import { saveEncryptedFile } from '@/lib/e2eeFiles';
import { limitsFor } from '@/lib/tiers';
import UpgradeNote from './UpgradeNote';
import { logActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import { findSameName, groupVersions, nextVersionInfo } from '@/lib/fileVersions';
import { INDEXABLE, extractText } from '@/lib/fileText';
import { IMAGE_RE, PDF_RE, extractPdf, ocrImages } from '@/lib/pdfText';

const iconFor = (mime: string, name: string) => (mime.startsWith('image/') ? FileImage : /pdf|word|text|document/.test(mime) || /\.(pdf|docx?|txt)$/i.test(name) ? FileText : FileIcon);

// Soubory spisu: složky, nahrávání (i přetažením), otevření a přesun
export default function CaseFilesTab({ item, bundle, userId, lawyer, setBundle, fail }: TabProps) {
    const limits = limitsFor(lawyer);
    const [folderId, setFolderId] = useState<string>('all');
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [newFolder, setNewFolder] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const [openVersions, setOpenVersions] = useState<string | null>(null);
    // Které soubory už mají vytažený text (pro hledání v obsahu); bez migrace 20261118_09 se funkce tiše vypne
    const [indexed, setIndexed] = useState<Set<string> | null>(null);
    const [indexing, setIndexing] = useState(false);
    useEffect(() => {
        let a = true;
        supabase.from('case_file_text').select('file_id').eq('case_id', item.id).then(({ data, error }) => { if (a) setIndexed(error ? null : new Set(((data ?? []) as { file_id: string }[]).map((x) => x.file_id))); });
        return () => { a = false; };
    }, [item.id]);
    async function saveText(fileId: string, text: string) {
        const { error } = await supabase.from('case_file_text').upsert({ file_id: fileId, case_id: item.id, user_id: userId, body: text });
        if (!error) setIndexed((s) => new Set([...(s ?? []), fileId]));
    }
    async function indexText(fileId: string, name: string, bytes: ArrayBuffer) {
        if (PDF_RE.test(name)) { const r = await extractPdf(bytes, { ocr: false }); if (r.ok) await saveText(fileId, r.text); else if (r.reason === 'needs_ocr') setScans((s) => new Set([...s, fileId])); return; }
        const text = await extractText(name, bytes); if (!text) return;
        await saveText(fileId, text);
    }
    // Soubory, které nejde přečíst bez rozpoznání textu (skeny a obrázky); OCR běží až na pokyn, je pomalé
    const [scans, setScans] = useState<Set<string>>(new Set());
    const [ocrNote, setOcrNote] = useState('');
    const ocrChain = useRef<Promise<void>>(Promise.resolve());
    function autoOcr(fileId: string, name: string, bytes: ArrayBuffer) {
        if (!IMAGE_RE.test(name) && !PDF_RE.test(name)) return;
        ocrChain.current = ocrChain.current.then(async () => {
            try {
                if (IMAGE_RE.test(name)) { setOcrNote(`Rozpoznávám text v souboru ${name}…`); const m = await ocrImages([{ id: fileId, bytes, name }]); const t = m.get(fileId); if (t) { await saveText(fileId, t); setOcrNote(`Text v souboru ${name} je rozpoznán a jde v něm hledat.`); } else setOcrNote(`V souboru ${name} se nenašel čitelný text.`); }
                else { const r = await extractPdf(bytes, { ocr: false }); if (r.ok) return; if (r.reason !== 'needs_ocr') return; setOcrNote(`Rozpoznávám text ve skenu ${name}…`); const o = await extractPdf(bytes, { ocr: true, onProgress: (p) => setOcrNote(`${name}: strana ${p.page} z ${p.pages}…`) }); if (o.ok) { await saveText(fileId, o.text); setOcrNote(`Text ve skenu ${name} je rozpoznán a jde v něm hledat.`); } }
            } catch { setOcrNote(`Rozpoznání textu v souboru ${name} se nepodařilo, zkuste tlačítko Rozpoznat text.`); }
        });
    }
    const canIndex = (f: { enc?: boolean; name: string }) => !f.enc && (INDEXABLE.test(f.name) || PDF_RE.test(f.name));
    const toIndex = indexed ? bundle.files.filter((f) => canIndex(f) && !indexed.has(f.id) && !scans.has(f.id)) : [];
    const toOcr = indexed ? bundle.files.filter((f) => !f.enc && !indexed.has(f.id) && (scans.has(f.id) || IMAGE_RE.test(f.name))) : [];
    async function indexAll() {
        setIndexing(true);
        for (const f of toIndex) { try { const { data } = await supabase.storage.from('case-files').download(f.path); if (data) await indexText(f.id, f.name, await data.arrayBuffer()); } catch { /* další soubor */ } }
        setIndexing(false);
    }
    async function ocrAll() {
        setIndexing(true); let done = 0;
        try {
            const imgs: { id: string; bytes: ArrayBuffer; name: string }[] = [];
            for (const f of toOcr) {
                const { data } = await supabase.storage.from('case-files').download(f.path); if (!data) continue;
                const bytes = await data.arrayBuffer();
                if (PDF_RE.test(f.name)) {
                    const r = await extractPdf(bytes, { ocr: true, onProgress: (p) => setOcrNote(`${f.name}: ${p.phase === 'ocr' ? 'rozpoznávám text' : 'čtu'} stranu ${p.page} z ${p.pages}…`) });
                    if (r.ok) { await saveText(f.id, r.text); done++; }
                } else imgs.push({ id: f.id, bytes, name: f.name });
            }
            const got = await ocrImages(imgs, (n, t) => setOcrNote(`Rozpoznávám obrázky: ${n} z ${t}…`));
            for (const [id, text] of got) { await saveText(id, text); done++; }
            setScans((s) => new Set([...s].filter((id) => !(indexed ?? new Set()).has(id))));
            setOcrNote(`Hotovo, text rozpoznán u ${done} z ${toOcr.length} souborů. Rozpoznání je strojové a může obsahovat chyby.`);
        } catch { setOcrNote('Rozpoznání textu se nepodařilo dokončit. Zkuste to znovu, případně s menším počtem souborů.'); }
        setIndexing(false);
    }
    const channel = useChannelKey(item.id);
    const names = useDecryptedNames(bundle.files, channel.key);
    const shownName = (f: (typeof bundle.files)[number]) => (f.enc ? (names[f.id] ?? 'Šifrovaný soubor') : f.name);
    async function openFile(f: (typeof bundle.files)[number], download: boolean) {
        logActivity('file_opened', { caseId: item.id, label: shownName(f), ref: `file:${f.id}` });
        if (!f.enc) { await openCaseFile(f.path, download).catch(fail); return; }
        if (!channel.key) { fail(new Error('Šifrovaný soubor. Nejdřív odemkněte šifrování v záložce Klient.')); return; }
        await saveEncryptedFile(f.path, channel.key, shownName(f)).catch(fail);
    }

    const total = bundle.files.reduce((sum, f) => sum + f.size, 0);
    const visible = bundle.files.filter((f) => (folderId === 'all' || (folderId === 'none' ? !f.folder_id : f.folder_id === folderId)) && shownName(f).toLowerCase().includes(query.trim().toLowerCase()));

    async function upload(list: FileList | File[]) {
        const files = [...list];
        if (!files.length) return;
        if (bundle.files.length + files.length > limits.filesPerCase) { fail(new Error(`Bezplatný účet umožňuje nejvýše ${limits.filesPerCase} souborů na případ.`)); return; }
        if (total + files.reduce((s, f) => s + f.size, 0) > limits.bytesPerCase) { fail(new Error(`Spis může mít nejvýše ${Math.round(limits.bytesPerCase / 1024 / 1024)} MB souborů.`)); return; }
        setBusy(true);
        const target = folderId === 'all' || folderId === 'none' ? null : folderId;
        for (const file of files) {
            try {
                // Stejný název ve stejné složce: nabídne se nová verze (starší zůstane k dispozici)
                const same = findSameName(bundle.files, target, file.name);
                const asVersion = !!same && window.confirm(`Soubor „${file.name}“ už ve spisu je. Nahrát jako novou verzi (starší verze zůstane k dispozici)?\n\nOK = nová verze, Zrušit = samostatný soubor.`);
                const saved = await uploadCaseFile(userId, item.id, target, file, asVersion && same ? nextVersionInfo(bundle.files, same) : {});
                setBundle((b) => ({ ...b, files: [saved, ...b.files] }));
                // Text se zpřístupní hned po nahrání; u skenů a obrázků běží rozpoznání samo na pozadí (jeden soubor po druhém)
                if (indexed && !saved.enc) void file.arrayBuffer().then(async (buf) => { if (canIndex({ name: file.name })) await indexText(saved.id, file.name, buf); autoOcr(saved.id, file.name, buf); });
            } catch (err) { fail(err); }
        }
        setBusy(false);
    }

    async function addFolder(name: string) {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (bundle.folders.length >= limits.foldersPerCase) { fail(new Error(`Bezplatný účet umožňuje nejvýše ${limits.foldersPerCase} složky na případ.`)); return; }
        try {
            const folder = await insertRow<CaseFolder>('case_folders', { case_id: item.id, user_id: userId, name: trimmed.slice(0, 60) });
            setBundle((b) => ({ ...b, folders: [...b.folders, folder] }));
            setNewFolder('');
        } catch (err) { fail(err); }
    }

    async function addDefaults() {
        for (const name of DEFAULT_FOLDERS) await addFolder(name);
    }

    async function removeFolder(folder: CaseFolder) {
        if (!window.confirm(`Smazat složku „${folder.name}“? Soubory v ní zůstanou ve spisu bez složky.`)) return;
        try {
            await deleteRow('case_folders', folder.id);
            setBundle((b) => ({ ...b, folders: b.folders.filter((f) => f.id !== folder.id), files: b.files.map((f) => (f.folder_id === folder.id ? { ...f, folder_id: null } : f)) }));
            if (folderId === folder.id) setFolderId('all');
        } catch (err) { fail(err); }
    }

    async function moveFile(fileId: string, to: string) {
        const target = to || null;
        try {
            await updateRow('case_files', fileId, { folder_id: target });
            setBundle((b) => ({ ...b, files: b.files.map((f) => (f.id === fileId ? { ...f, folder_id: target } : f)) }));
        } catch (err) { fail(err); }
    }

    async function remove(file: (typeof bundle.files)[number]) {
        if (!window.confirm(`Smazat soubor „${file.name}“ ze spisu?`)) return;
        try { await removeCaseFile(file); setBundle((b) => ({ ...b, files: b.files.filter((f) => f.id !== file.id) })); } catch (err) { fail(err); }
    }

    const chip = (id: string, label: string, count: number) => (
        <button key={id} type="button" aria-pressed={folderId === id} onClick={() => setFolderId(id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${folderId === id ? 'border-indigo-700 bg-indigo-100 text-indigo-950' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-400'}`}>
            <Folder size={13} /> {label} <span className="text-slate-500">{count}</span>
        </button>
    );

    return (
        <div className="space-y-5">
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
                className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-slate-50'}`}
            >
                <Upload size={26} className="mx-auto text-indigo-800" />
                <p className="mt-2 text-sm font-semibold text-slate-800">Přetáhněte sem soubory nebo fotky</p>
                <p className="text-xs text-slate-500"><Lock size={11} className="mr-1 inline text-indigo-800" aria-hidden="true" />Soubory jsou uložené šifrovaně v soukromém úložišti a vidíte je jen vy.</p>
                <p className="text-xs text-slate-500">PDF, dokumenty, obrázky · do 15 MB na soubor · {formatSize(total)} z {Math.round(limits.bytesPerCase / 1024 / 1024)} MB{!lawyer && ` · ${bundle.files.length} z ${limits.filesPerCase} souborů`}</p>
                <input ref={input} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
                <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`${primaryBtn} mt-3`}>{busy ? 'Nahrávám…' : 'Vybrat soubory'}</button>
                {folderId !== 'all' && folderId !== 'none' && <p className="mt-2 text-xs text-slate-500">Uloží se do složky „{bundle.folders.find((f) => f.id === folderId)?.name}“.</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {chip('all', 'Vše', bundle.files.length)}
                {bundle.folders.map((f) => chip(f.id, f.name, bundle.files.filter((x) => x.folder_id === f.id).length))}
                {bundle.files.some((f) => !f.folder_id) && bundle.folders.length > 0 && chip('none', 'Bez složky', bundle.files.filter((f) => !f.folder_id).length)}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addFolder(newFolder); }} placeholder="Nová složka…" maxLength={60} className={`${inputCls} max-w-56`} aria-label="Název nové složky" />
                <button type="button" onClick={() => void addFolder(newFolder)} className={ghostBtn}><FolderPlus size={15} /> Přidat složku</button>
                {bundle.folders.length === 0 && <button type="button" onClick={() => void addDefaults()} className={ghostBtn}>Vytvořit základní složky</button>}
                {folderId !== 'all' && folderId !== 'none' && (
                    <button type="button" onClick={() => { const f = bundle.folders.find((x) => x.id === folderId); if (f) void removeFolder(f); }} className="text-xs text-rose-700 hover:underline cursor-pointer">Smazat tuto složku</button>
                )}
            </div>

            {!lawyer && bundle.files.length >= limits.filesPerCase - 2 && <UpgradeNote>Bezplatný účet má limit souborů a velikosti na případ. Bez limitů a se ZIP exportem přes</UpgradeNote>}

            {toIndex.length > 0 && <p className="flex flex-wrap items-center gap-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">Obsah {toIndex.length} {toIndex.length === 1 ? 'souboru' : 'souborů'} (txt, csv, md, html, docx, PDF s textem) zatím nejde hledat. <button type="button" onClick={() => void indexAll()} disabled={indexing} className={ghostBtn}>{indexing ? 'Zpracovávám…' : 'Zpřístupnit pro hledání'}</button><span className="text-xs text-indigo-900">Čte se ve vašem prohlížeči. Šifrované soubory se nikdy neindexují.</span></p>}
            {toOcr.length > 0 && <p className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{toOcr.length} {toOcr.length === 1 ? 'soubor je sken nebo obrázek' : 'souborů jsou skeny nebo obrázky'} bez textu. <button type="button" onClick={() => void ocrAll()} disabled={indexing} className={ghostBtn}>{indexing ? 'Rozpoznávám…' : 'Rozpoznat text (OCR)'}</button><span className="text-xs text-amber-900">Běží ve vašem prohlížeči, soubor se nikam neposílá. Trvá řádově několik sekund na stranu a výsledek může obsahovat chyby.</span></p>}
            {ocrNote && <p role="status" className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{ocrNote}</p>}

            {bundle.files.length > 4 && <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat v názvech souborů…" className={inputCls} aria-label="Hledat v souborech" />}

            {visible.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{bundle.files.length === 0 ? 'Zatím tu nejsou žádné soubory. Vložte třeba doručený dokument nebo fotku.' : 'V této složce nic není.'}</p>
            ) : (
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                    {groupVersions(visible).flatMap((g) => [g.latest, ...(openVersions === g.latest.id ? g.older : [])].map((file) => ({ file, g }))).map(({ file, g }) => {
                        const isOld = file.id !== g.latest.id;
                        const Icon = iconFor(file.mime, shownName(file));
                        return (
                            <li key={file.id} className={`flex flex-wrap items-center gap-3 p-3 sm:p-4 ${isOld ? 'bg-slate-50 pl-8' : ''}`}>
                                <Icon size={22} className="shrink-0 text-indigo-800" />
                                <button type="button" onClick={() => void openFile(file, false)} className="min-w-0 flex-1 text-left cursor-pointer">
                                    <span className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-800">{shownName(file)}{file.enc && <Lock size={12} className="ml-1.5 inline text-indigo-800" aria-label="Šifrováno end-to-end" />}{file.source === 'client' && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-indigo-900">od klienta</span>}</span>
                                    <span className="text-xs text-slate-500">{formatSize(file.size)} · {shortDate(new Date(file.created_at))}{(file.version ?? 1) > 1 || g.older.length > 0 ? ` · verze ${file.version ?? 1}` : ''}{isOld ? ' (starší)' : ''}</span>
                                </button>
                                {bundle.folders.length > 0 && (
                                    <select value={file.folder_id ?? ''} onChange={(e) => void moveFile(file.id, e.target.value)} aria-label={`Složka souboru ${shownName(file)}`} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
                                        <option value="">Bez složky</option>
                                        {bundle.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                )}
                                {!isOld && g.older.length > 0 && <button type="button" onClick={() => setOpenVersions(openVersions === file.id ? null : file.id)} aria-expanded={openVersions === file.id} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Starší verze ({g.older.length})</button>}
                                <button type="button" onClick={() => void openFile(file, true)} aria-label={`Stáhnout ${shownName(file)}`} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"><Download size={16} /></button>
                                <button type="button" onClick={() => void remove(file)} aria-label={`Smazat ${shownName(file)}`} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"><Trash2 size={16} /></button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
