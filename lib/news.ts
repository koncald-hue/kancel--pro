// Právní novinky: aplikace sama sestaví přehled z veřejných kanálů RSS (nové předpisy, nová znění zákonů, články a zprávy ze světa práva).
// Zobrazuje se jen název, krátký výtah a odkaz na zdroj; celý text patří zdroji.
export type NewsKind = 'predpis' | 'zneni' | 'ucinne' | 'svet';
export type NewsItem = { id: string; kind: NewsKind; source: string; title: string; summary: string; url: string; date: string; effective: string | null };

export const FEEDS: { url: string; kind: NewsKind; source: string }[] = [
    { url: 'https://www.zakonyprolidi.cz/cs/nove-predpisy.rss', kind: 'predpis', source: 'Sbírka zákonů' },
    { url: 'https://www.zakonyprolidi.cz/cs/nova-zneni.rss', kind: 'zneni', source: 'Sbírka zákonů' },
    { url: 'https://www.zakonyprolidi.cz/cs/nove-ucinne.rss', kind: 'ucinne', source: 'Sbírka zákonů' },
    { url: 'https://www.epravo.cz/rss.php', kind: 'svet', source: 'epravo.cz' },
    { url: 'https://advokatnidenik.cz/feed/', kind: 'svet', source: 'Advokátní deník' },
];
export const KIND_LABEL: Record<NewsKind, string> = { predpis: 'Nový předpis', zneni: 'Změna zákona', ucinne: 'Nově účinné', svet: 'Právní svět' };

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };
export function decodeEntities(s: string): string {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
        if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
        return ENT[e.toLowerCase()] ?? m;
    });
}
// Popisy bývají HTML zapsané jako text (&lt;p&gt;): nejdřív se rozbalí entity, pak odstraní značky
export const stripHtml = (s: string) => {
    const noTags = (x: string) => x.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    return decodeEntities(noTags(decodeEntities(noTags(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))))).replace(/\s+/g, ' ').trim();
};
const tag = (block: string, name: string) => { const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : ''; };
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '')}…`);

export function toIsoDate(raw: string): string | null {
    const t = raw.trim(); if (!t) return null;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T12:00:00Z` : t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
// Nová znění zákonů mají na začátku názvu datum účinnosti: „18.11.2026 - č. 393/2020 Sb. - …“
export function effectiveFrom(title: string): string | null {
    const m = title.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s*-\s/);
    if (!m) return null;
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}
const safeUrl = (u: string) => { try { const x = new URL(decodeEntities(u.trim())); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : ''; } catch { return ''; } };

// RSS 2.0 i Atom
export function parseFeed(xml: string, feed: { kind: NewsKind; source: string }): NewsItem[] {
    const blocks = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi)].map((m) => m[0]);
    const out: NewsItem[] = [];
    for (const b of blocks) {
        const title = stripHtml(tag(b, 'title'));
        const link = safeUrl(tag(b, 'link').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') || (b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? ''));
        const date = toIsoDate(stripHtml(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')));
        if (!title || !link || !date) continue;
        let summary = stripHtml(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content'));
        // Popis, který jen opakuje název, nic nepřidává
        if (summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 40)) && summary.length < title.length + 60) summary = '';
        out.push({ id: link, kind: feed.kind, source: feed.source, title: clip(title, 500), summary: clip(summary, 260), url: link, date, effective: feed.kind === 'zneni' || feed.kind === 'ucinne' ? effectiveFrom(title) : null });
    }
    return out;
}

// Spojí kanály: bez duplicit podle odkazu, nejnovější nahoře
export function mergeNews(lists: NewsItem[][], limit = 60): NewsItem[] {
    const seen = new Set<string>(); const all: NewsItem[] = [];
    for (const it of lists.flat()) { if (seen.has(it.id)) continue; seen.add(it.id); all.push(it); }
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export const daysFromToday = (iso: string, today = new Date()) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T12:00:00`).getTime()) / 86_400_000);

// „04.12.2026 - č. 419/2012 Sb. - Vyhláška o ochraně pokusných zvířat - ve znění 31/2026 Sb.“ → číslo, název, kým je měněn
export function parseLawTitle(title: string): { number: string; name: string; amendedBy: string } {
    let t = title.replace(/^\d{1,2}\.\d{1,2}\.\d{4}\s*-\s*/, '');
    const num = t.match(/^č\.\s*(\d+\/\d{4}\s*Sb\.(?:\s*m\.\s*s\.)?)\s*-\s*/i);
    const number = num ? num[1].replace(/\s+/g, ' ') : '';
    if (num) t = t.slice(num[0].length);
    const am = t.match(/\s+-\s+ve znění\s+(.+)$/i);
    const amendedBy = am ? am[1].trim() : '';
    if (am) t = t.slice(0, am.index);
    return { number, name: t.trim(), amendedBy };
}

export function ago(iso: string, now = new Date()): string {
    const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
    if (d <= 0) return 'dnes'; if (d === 1) return 'včera';
    if (d < 7) return `před ${d} ${d < 5 ? 'dny' : 'dny'}`;
    if (d < 31) { const w = Math.floor(d / 7); return `před ${w} ${w === 1 ? 'týdnem' : 'týdny'}`; }
    return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

// ---------- plné názvy předpisů ----------
// Kanál zkracuje dlouhé názvy („…související s opatřeními přijatými v souvislos…“); úplný název je na stránce předpisu.
export const isTruncated = (title: string) => /(…|\.\.\.)\s*$/.test(title.trim());
export const isLawPageUrl = (url: string) => /^https:\/\/www\.zakonyprolidi\.cz\/cs\/\d{4}-\d+(\/zneni-\d{8})?$/.test(url);
export const lawBaseUrl = (url: string) => url.replace(/\/zneni-\d{8}$/, '');
export function extractFullName(html: string): string {
    const m = html.match(/<span class="h1a">([\s\S]*?)<\/span>/i);
    if (m) return stripHtml(m[1]);
    const d = html.match(/<meta name="description" content="([^"]*)"/i);
    return d ? stripHtml(d[1]).replace(/^.*? Sb\.\s*-\s*/, '') : '';
}
export function applyFullName(item: NewsItem, fullName: string): NewsItem {
    if (!fullName) return item;
    if (item.kind === 'predpis') { const law = parseLawTitle(item.title); return { ...item, title: `${law.number ? `č. ${law.number} - ` : ''}${fullName}` }; }
    if (item.kind === 'zneni' || item.kind === 'ucinne') {
        const date = item.title.match(/^\d{1,2}\.\d{1,2}\.\d{4}\s*-\s*/)?.[0] ?? '';
        const law = parseLawTitle(item.title);
        return { ...item, title: `${date}${law.number ? `č. ${law.number} - ` : ''}${fullName}${law.amendedBy && !isTruncated(law.amendedBy) ? ` - ve znění ${law.amendedBy}` : ''}` };
    }
    return item;
}

// Druh předpisu srozumitelně: co to je a oč jde
export function lawType(name: string): string {
    const n = name.trim();
    if (/^(Zákon|Zákonné opatření|Ústavní zákon)[^,]*,\s*kter[ýáé]m? se mění|^Zákon .* o změně/i.test(n)) return 'Novela zákona';
    if (/^Nařízení vlády,\s*kter[ýáé]m se mění/i.test(n)) return 'Novela nařízení vlády';
    if (/^Vyhláška,\s*kterou se mění/i.test(n)) return 'Novela vyhlášky';
    if (/^Ústavní zákon/i.test(n)) return 'Ústavní zákon';
    if (/^Zákon/i.test(n)) return 'Zákon';
    if (/^Nařízení vlády/i.test(n)) return 'Nařízení vlády';
    if (/^Vyhláška/i.test(n)) return 'Vyhláška';
    if (/^(Rámcová )?(smlouva|dohoda)|^Úmluva|^Protokol|^Mezinárodní/i.test(n)) return 'Mezinárodní smlouva';
    if (/^Sdělení/i.test(n)) return 'Sdělení';
    if (/^Nález/i.test(n)) return 'Nález Ústavního soudu';
    return '';
}
