import { describe, expect, it } from 'vitest';
import { daysFromToday, decodeEntities, effectiveFrom, mergeNews, parseFeed, stripHtml, type NewsItem } from './news';

const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
<item><title>č. 216/2026 Sb. - Nařízení vlády &amp; spol.</title><link>https://www.zakonyprolidi.cz/cs/2026-216</link><pubDate>2026-11-09</pubDate><description><![CDATA[č. 216/2026 Sb. - Nařízení vlády &amp; spol. vyhlášeno 9.11.2026]]></description></item>
<item><title>Konec mírných trestů</title><link>https://www.epravo.cz/a-1.html</link><pubDate>Mon, 16 Nov 2026 00:10:00 +0100</pubDate><description>&lt;p&gt;Novela &lt;b&gt;trestního&lt;/b&gt; práva přináší přísnější tresty za ničení přírody.&lt;/p&gt;</description></item>
<item><title>Bez odkazu</title><pubDate>2026-11-01</pubDate></item>
<item><title>Nebezpečný odkaz</title><link>javascript:alert(1)</link><pubDate>2026-11-01</pubDate></item>
</channel></rss>`;
const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom článek</title><link href="https://example.cz/a"/><updated>2026-11-15T10:00:00Z</updated><summary>Krátký souhrn</summary></entry></feed>`;

describe('legal news', () => {
    it('parses RSS items, decodes entities, strips HTML and drops unusable items', () => {
        const items = parseFeed(rss, { kind: 'predpis', source: 'Sbírka zákonů' });
        expect(items).toHaveLength(2);
        expect(items[0]).toMatchObject({ title: 'č. 216/2026 Sb. - Nařízení vlády & spol.', url: 'https://www.zakonyprolidi.cz/cs/2026-216', kind: 'predpis' });
        expect(items[0].summary).toBe('');
        expect(items[1].summary).toBe('Novela trestního práva přináší přísnější tresty za ničení přírody.');
        expect(items[1].date.startsWith('2026-11-15')).toBe(true);
    });
    it('parses Atom entries', () => {
        const items = parseFeed(atom, { kind: 'svet', source: 'X' });
        expect(items[0]).toMatchObject({ title: 'Atom článek', url: 'https://example.cz/a', summary: 'Krátký souhrn' });
    });
    it('reads the effective date from the title of a new consolidated version', () => {
        expect(effectiveFrom('18.11.2026 - č. 393/2020 Sb. - Vyhláška o digitální technické mapě kraje')).toBe('2026-11-18');
        expect(effectiveFrom('Něco jiného')).toBeNull();
        expect(effectiveFrom('31.2.2026 - x')).toBeNull();
        const z = parseFeed('<rss><item><title>18.11.2026 - č. 393/2020 Sb. - Vyhláška</title><link>https://z.cz/1</link><pubDate>2026-11-18</pubDate></item></rss>', { kind: 'zneni', source: 'S' });
        expect(z[0].effective).toBe('2026-11-18');
    });
    it('merges feeds without duplicates and newest first', () => {
        const mk = (id: string, date: string): NewsItem => ({ id, kind: 'svet', source: 's', title: id, summary: '', url: id, date, effective: null });
        expect(mergeNews([[mk('a', '2026-11-10T00:00:00Z'), mk('b', '2026-11-12T00:00:00Z')], [mk('a', '2026-11-10T00:00:00Z'), mk('c', '2026-11-11T00:00:00Z')]]).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    });
    it('helpers: entities, tags, day difference', () => {
        expect(decodeEntities('A&nbsp;&amp;&#8211;&#x41;&bogus;')).toBe('A &–A&bogus;');
        expect(stripHtml('<![CDATA[<b>x</b> &lt;i&gt;y&lt;/i&gt;]]>')).toBe('x y');
        expect(daysFromToday('2026-11-20', new Date('2026-11-17T09:00:00'))).toBe(3);
    });
});

describe('law titles and relative dates', () => {
    it('splits number, name and amending act', async () => {
        const { parseLawTitle, ago } = await import('./news');
        expect(parseLawTitle('04.12.2026 - č. 419/2012 Sb. - Vyhláška o ochraně pokusných zvířat - ve znění 31/2026 Sb.')).toEqual({ number: '419/2012 Sb.', name: 'Vyhláška o ochraně pokusných zvířat', amendedBy: '31/2026 Sb.' });
        expect(parseLawTitle('č. 216/2026 Sb. - Nařízení vlády')).toEqual({ number: '216/2026 Sb.', name: 'Nařízení vlády', amendedBy: '' });
        expect(parseLawTitle('Jen obyčejný titulek')).toEqual({ number: '', name: 'Jen obyčejný titulek', amendedBy: '' });
        const now = new Date('2026-11-17T12:00:00Z');
        expect(ago('2026-11-17T08:00:00Z', now)).toBe('dnes'); expect(ago('2026-11-16T08:00:00Z', now)).toBe('včera'); expect(ago('2026-11-13T08:00:00Z', now)).toBe('před 4 dny'); expect(ago('2026-11-03T08:00:00Z', now)).toBe('před 2 týdny');
    });
});
