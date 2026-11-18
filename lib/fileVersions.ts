import type { CaseFile } from './caseFile';

// Verze dokumentů: soubory se stejným názvem ve stejné složce, navázané přes version_of. Nejnovější verze je ta s nejvyšším číslem.
export type FileGroup = { latest: CaseFile; older: CaseFile[] };
const rootId = (f: CaseFile, byId: Map<string, CaseFile>): string => { let cur = f; const seen = new Set<string>(); while (cur.version_of && byId.has(cur.version_of) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.version_of)!; } return cur.id; };

export function groupVersions(files: CaseFile[]): FileGroup[] {
    const byId = new Map(files.map((f) => [f.id, f]));
    const groups = new Map<string, CaseFile[]>();
    for (const f of files) { const k = rootId(f, byId); groups.set(k, [...(groups.get(k) ?? []), f]); }
    return [...groups.values()].map((list) => { const sorted = [...list].sort((a, b) => (b.version ?? 1) - (a.version ?? 1) || b.created_at.localeCompare(a.created_at)); return { latest: sorted[0], older: sorted.slice(1) }; })
        .sort((a, b) => b.latest.created_at.localeCompare(a.latest.created_at));
}

// Existuje už nešifrovaný soubor stejného názvu ve stejné složce? Pak je nabídka „nová verze“ na místě.
export function findSameName(files: CaseFile[], folderId: string | null, name: string): CaseFile | null {
    const norm = name.trim().toLowerCase();
    const same = files.filter((f) => !f.enc && (f.folder_id ?? null) === folderId && f.name.trim().toLowerCase() === norm);
    if (!same.length) return null;
    return groupVersions(same)[0].latest;
}

export function nextVersionInfo(files: CaseFile[], existing: CaseFile): { version_of: string; version: number } {
    const byId = new Map(files.map((f) => [f.id, f])); const root = rootId(existing, byId);
    const max = Math.max(...files.filter((f) => rootId(f, byId) === root).map((f) => f.version ?? 1));
    return { version_of: root, version: max + 1 };
}
