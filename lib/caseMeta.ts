// Druh případu, štítky a odpovědná osoba u věci
export const CASE_TYPES = ['Občanskoprávní', 'Obchodní', 'Trestní', 'Správní', 'Pracovně-právní', 'Rodinné', 'Exekuční', 'Insolvence', 'Směnečné', 'Rozhodčí řízení', 'Advokátní úschova', 'Jiné'] as const;
export const MAX_LABELS = 12;

// Štítky: bez prázdných, bez duplicit (bez ohledu na velikost písmen), do 24 znaků, nejvýše MAX_LABELS
export function cleanLabels(list: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list) {
        const t = raw.replace(/\s+/g, ' ').trim().slice(0, 24);
        if (!t || seen.has(t.toLowerCase())) continue;
        seen.add(t.toLowerCase()); out.push(t);
        if (out.length >= MAX_LABELS) break;
    }
    return out;
}
