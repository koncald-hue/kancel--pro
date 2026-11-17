// Kontrola před odesláním podání datovou zprávou: najde chyby, kterým se dá snadno předejít (špatný adresát, chybějící spisová značka, nevhodné přílohy, uplynulá lhůta).
// Jde jen o pomůcku; rozhoduje advokát.
export type Level = 'error' | 'warn' | 'info' | 'ok';
export type Check = { level: Level; text: string };

export type PreflightInput = {
    recipientId: string; recipientName: string | null; annotation: string;
    files: { name: string; size: number; type: string; signed?: boolean | null }[];
    caseRef?: { title: string; reference?: string; authority?: string } | null;
    deadlines?: { title: string; due: string; done: boolean }[];
    prod: boolean; today?: string;
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Spisová značka: „12 C 345/2026“, „5 Nc 12/2025“, „KSPL 45 INS 1234/2026“, „MSPH 12 A 3/2025“
export const FILE_NO = /\b(?:[A-ZŠČŘŽÝÁÍÉÚŮĚŤĎŇ]{2,6}\s+)?\d{1,3}\s*[A-Za-zČŘŠŽÝÁÍÉÚŮĚŤĎŇčřšžýáíéúůěťďň]{1,6}\s*\d{1,6}\s*\/\s*\d{4}\b/g;
const normNo = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const days = (a: string, b: string) => Math.round((new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 86_400_000);
const BLOCKED_EXT = ['exe', 'bat', 'cmd', 'com', 'js', 'msi', 'scr', 'vbs', 'zip', 'rar', '7z'];
const NORMAL_EXT = ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'tif', 'tiff', 'zfo', 'isdoc'];
const DRAFT = /koncept|draft|navrh|návrh|kopie|copy|verze|v\d\b|final|bez podpisu|test/i;

export function preflight(i: PreflightInput): Check[] {
    const out: Check[] = []; const today = i.today ?? new Date().toISOString().slice(0, 10);
    const add = (level: Level, text: string) => out.push({ level, text });

    // Adresát
    if (!/^[a-z0-9]{7}$/.test(i.recipientId)) add('error', 'ID datové schránky adresáta musí mít 7 znaků.');
    else if (i.recipientName) add('ok', `Adresát: ${i.recipientName}.`);
    else add('warn', `Adresát je zadaný jen ID ${i.recipientId}, jeho název se neověřil. Zkontrolujte, že jde o správnou schránku.`);
    if (i.caseRef?.authority && i.recipientName) {
        const stop = new Set(['soud', 'urad', 'ceske', 'republiky', 'statni']); const words = (x: string) => fold(x).split(' ').filter((t) => t.length >= 4 && !stop.has(t));
        const want = new Set(words(i.caseRef.authority)); const got = words(i.recipientName);
        if (want.size && !got.some((t) => want.has(t))) add('warn', `Věc je vedena u „${i.caseRef.authority}“, ale adresátem je „${i.recipientName}“. Je to záměr?`);
    }

    // Věc zprávy a spisová značka
    const ann = i.annotation.trim();
    if (!ann) add('error', 'Chybí „věc zprávy“.');
    else {
        if (ann.length < 12) add('warn', 'Věc zprávy je velmi stručná. Soud nebo úřad ji uvidí jako první, uveďte druh podání a spisovou značku.');
        const nums = [...ann.matchAll(FILE_NO)].map((m) => m[0]);
        const ref = i.caseRef?.reference?.trim();
        if (ref) {
            if (nums.length === 0) add('warn', `Ve věci zprávy chybí spisová značka. Věc má značku ${ref}.`);
            else if (!nums.some((n) => normNo(n).includes(normNo(ref)) || normNo(ref).includes(normNo(n)))) add('warn', `Ve věci zprávy je značka ${nums[0]}, ale věc má značku ${ref}. Zkontrolujte, že podání jde do správného řízení.`);
            else add('ok', `Spisová značka ${ref} je uvedena.`);
        } else if (nums.length === 0 && /podan|žalob|zalob|odvol|vyjadren|vyjádření|návrh|navrh|odpor/i.test(ann)) add('info', 'Ve věci zprávy není spisová značka. U podání v už vedeném řízení ji uveďte.');
    }

    // Přílohy
    if (i.files.length === 0) add('error', 'Chybí příloha. Datová zpráva musí obsahovat aspoň jeden dokument.');
    const total = i.files.reduce((s, f) => s + f.size, 0);
    if (total > 10 * 1024 * 1024) add('error', 'Přílohy jsou dohromady větší než 10 MB.');
    for (const f of i.files) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (f.size === 0) add('error', `Příloha „${f.name}“ je prázdná.`);
        if (BLOCKED_EXT.includes(ext)) add('error', `Příloha „${f.name}“ (.${ext}) bývá datovou schránkou nebo příjemcem odmítnuta. Použijte PDF.`);
        else if (ext && !NORMAL_EXT.includes(ext)) add('warn', `Příloha „${f.name}“ má neobvyklý formát (.${ext}). Příjemce ji nemusí otevřít.`);
        if (DRAFT.test(f.name.replace(/\.[^.]+$/, ''))) add('warn', `Název přílohy „${f.name}“ vypadá jako koncept nebo kopie. Posíláte správnou verzi?`);
    }
    const main = i.files[0];
    if (main) {
        const ext = main.name.split('.').pop()?.toLowerCase();
        if (ext && !['pdf', 'zfo'].includes(ext) && NORMAL_EXT.includes(ext)) add('info', `Hlavní dokument je .${ext}. Soudy a úřady zpravidla preferují PDF.`);
        if (ext === 'pdf' && main.signed === false) add('info', 'V hlavním PDF jsem nenašel elektronický podpis. Podání z datové schránky se obvykle podepisuje samotným odesláním, ale ověřte požadavky daného řízení.');
        if (ext === 'pdf' && main.signed === true) add('ok', 'Hlavní PDF obsahuje elektronický podpis.');
    }
    const names = i.files.map((f) => f.name.toLowerCase());
    if (new Set(names).size !== names.length) add('warn', 'Některé přílohy mají stejný název. Zkontrolujte, že nenahráváte jeden soubor dvakrát.');

    // Lhůty ve věci
    const open = (i.deadlines ?? []).filter((d) => !d.done).sort((a, b) => a.due.localeCompare(b.due));
    const late = open.filter((d) => d.due < today);
    if (late.length) add('warn', `Ve věci je lhůta po termínu: „${late[0].title}“ (${late[0].due.split('-').reverse().map(Number).join('. ')}). Podání mohlo být zmeškáno.`);
    const next = open.find((d) => d.due >= today);
    if (next) { const n = days(next.due, today); add(n <= 2 ? 'warn' : 'info', n === 0 ? `Lhůta „${next.title}“ končí DNES. Zpráva se musí do schránky adresáta doručit nejpozději dnes.` : `Nejbližší lhůta ve věci: „${next.title}“ za ${n} ${n === 1 ? 'den' : n < 5 ? 'dny' : 'dní'}.`); }

    if (i.prod) add('warn', 'Odesíláte z OSTRÉHO prostředí. Odeslání nejde vzít zpět.');
    return out;
}

export const hasBlocker = (c: Check[]) => c.some((x) => x.level === 'error');
export const hasWarning = (c: Check[]) => c.some((x) => x.level === 'warn');

// Elektronický podpis v PDF: podepsané soubory obsahují slovník s položkou /ByteRange
export async function pdfSigned(file: Pick<File, 'arrayBuffer' | 'size'>): Promise<boolean | null> {
    try { if (file.size > 12 * 1024 * 1024) return null; const t = new TextDecoder('latin1').decode(new Uint8Array(await file.arrayBuffer())); return /\/ByteRange\s*\[/.test(t); } catch { return null; }
}
