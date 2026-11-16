import JSZip from 'jszip';

// Sestavení dokumentu Word (.docx) z textu s jednoduchým značením. Řádek bez značení je běžný odstavec.
//   # Název dokumentu        centrovaný nadpis dokumentu
//   ## I. Název článku         centrovaný nadpis článku
//   >> text                    odstavec zarovnaný doprava (např. „V Plzni dne …“)
//   1.  /  1.1  /  a)          číslovaný odstavec s předsazeným číslem
//   - text                     odrážka
//   | a | b |                  tabulka (první řádek je hlavička)
//   ::podpisy Levý | Pravý     dva podpisové bloky
//   ::strana                   nová stránka
//   **tučně**                  tučný text
export type DocxOptions = { title?: string; author?: string };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// Text s **tučným** na běhy (runs)
export function runs(text: string, base = ''): string {
    return text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '').map((p) => {
        const bold = p.startsWith('**') && p.endsWith('**') && p.length > 4;
        const content = bold ? p.slice(2, -2) : p;
        const rPr = `${base}${bold ? '<w:b/>' : ''}`;
        // Tabulátor v textu (číslovaný odstavec) je skutečný tabulátor
        const parts = content.split('\t').map((s) => `<w:t xml:space="preserve">${esc(s)}</w:t>`).join('<w:tab/>');
        return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${parts}</w:r>`;
    }).join('');
}
const para = (text: string, style?: string, extra = '') => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>${runs(text)}</w:p>`;

const CELL_BORDERS = '<w:tcBorders><w:top w:val="single" w:sz="4" w:color="808080"/><w:left w:val="single" w:sz="4" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:color="808080"/><w:right w:val="single" w:sz="4" w:color="808080"/></w:tcBorders>';
function table(rows: string[][]): string {
    const cols = Math.max(...rows.map((r) => r.length));
    const w = Math.floor(9072 / cols);
    const grid = Array.from({ length: cols }, () => `<w:gridCol w:w="${w}"/>`).join('');
    const tr = rows.map((r, i) => `<w:tr><w:trPr><w:cantSplit/>${i === 0 ? '<w:tblHeader/>' : ''}</w:trPr>${Array.from({ length: cols }, (_, c) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${CELL_BORDERS}${i === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="E7E9F5"/>' : ''}</w:tcPr><w:p><w:pPr><w:pStyle w:val="Tabulka"/></w:pPr>${runs(r[c] ?? '', i === 0 ? '<w:b/>' : '')}</w:p></w:tc>`).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${tr}</w:tbl><w:p><w:pPr><w:pStyle w:val="Normal"/><w:spacing w:after="60"/></w:pPr></w:p>`;
}
function signatures(left: string, right: string): string {
    // Čára pro podpis je řada podtržítek, aby vypadala stejně ve Wordu, LibreOffice i náhledech
    const cell = (label: string) => `<w:tc><w:tcPr><w:tcW w:w="4536" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="Podpis"/><w:spacing w:before="720"/><w:ind w:right="426"/></w:pPr><w:r><w:t>__________________________</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Podpis"/></w:pPr>${runs(label)}</w:p></w:tc>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4536"/><w:gridCol w:w="4536"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(left)}${cell(right)}</w:tr></w:tbl>`;
}

export function bodyXml(text: string): string {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const out: string[] = []; let pending: string[][] = []; let blank = 0;
    const flush = () => { if (pending.length) { out.push(table(pending)); pending = []; } };
    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (/^\|.*\|$/.test(line.trim())) { pending.push(line.trim().slice(1, -1).split('|').map((c) => c.trim())); blank = 0; continue; }
        flush();
        if (!line.trim()) { blank += 1; if (blank === 1) out.push('<w:p><w:pPr><w:pStyle w:val="Normal"/><w:spacing w:after="0"/></w:pPr></w:p>'); continue; }
        blank = 0;
        let m: RegExpMatchArray | null;
        if (line.startsWith('# ')) out.push(para(line.slice(2), 'Title'));
        else if (line.startsWith('## ')) out.push(para(line.slice(3), 'Heading1'));
        else if (line.startsWith('>> ')) out.push(para(line.slice(3), 'Vpravo'));
        else if (line.trim() === '::strana') out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
        else if ((m = line.match(/^::podpisy\s+(.*)\|(.*)$/))) out.push(signatures(m[1].trim(), m[2].trim()));
        else if (line.startsWith('- ')) out.push(para(`–\t${line.slice(2)}`, 'Odrazka'));
        else if ((m = line.match(/^(\d+(?:\.\d+)*\.|\d+(?:\.\d+)+)\s+(.*)$/)) && m[2]) out.push(para(`${m[1]}\t${m[2]}`, /\d\.\d/.test(m[1]) ? 'Odstavec2' : 'Odstavec1'));
        else if ((m = line.match(/^([a-z]\))\s+(.*)$/))) out.push(para(`${m[1]}\t${m[2]}`, 'Pismeno'));
        else out.push(para(line));
    }
    flush();
    return out.join('');
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="23"/><w:szCs w:val="23"/><w:lang w:val="cs-CZ" w:eastAsia="cs-CZ" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="320"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="280" w:after="120"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Vpravo"><w:name w:val="Vpravo"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="right"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Odstavec1"><w:name w:val="Odstavec 1"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="left" w:pos="567"/></w:tabs><w:ind w:left="567" w:hanging="567"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Odstavec2"><w:name w:val="Odstavec 2"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="left" w:pos="709"/></w:tabs><w:ind w:left="709" w:hanging="709"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Pismeno"><w:name w:val="Písmeno"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="left" w:pos="1134"/></w:tabs><w:ind w:left="1134" w:hanging="425"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Odrazka"><w:name w:val="Odrážka"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="left" w:pos="709"/></w:tabs><w:ind w:left="709" w:hanging="283"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Tabulka"><w:name w:val="Tabulka"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Podpis"><w:name w:val="Podpis"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="0"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
</w:styles>`;

const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">Strana </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> z </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;

export async function buildRichDocx(text: string, opt: DocxOptions = {}): Promise<Blob> {
    const title = opt.title ?? (text.split('\n').find((l) => l.startsWith('# '))?.slice(2).trim() ?? '');
    const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1417" w:bottom="1418" w:left="1417" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');
    zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${NS}><w:defaultTabStop w:val="709"/><w:themeFontLang w:val="cs-CZ"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
    zip.file('word/styles.xml', STYLES);
    zip.file('word/footer1.xml', FOOTER);
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml(text)}${sect}</w:body></w:document>`);
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(opt.author ?? 'Kancelář')}</dc:creator><dc:language>cs-CZ</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`);
    zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Kancelář</Application></Properties>');
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Náhled textu bez značení (pro zobrazení na obrazovce)
export function plainPreview(text: string): string {
    return text.replace(/\r\n?/g, '\n').split('\n').map((l) => {
        if (l.startsWith('# ')) return `\n${l.slice(2).toUpperCase()}\n`;
        if (l.startsWith('## ')) return `\n${l.slice(3)}`;
        if (l.startsWith('>> ')) return l.slice(3);
        if (l.trim() === '::strana') return '\n————————————\n';
        const sig = l.match(/^::podpisy\s+(.*)\|(.*)$/);
        if (sig) return `\n\n______________________        ______________________\n${sig[1].trim()}        ${sig[2].trim()}`;
        if (/^\|.*\|$/.test(l.trim())) return l.trim().slice(1, -1).split('|').map((c) => c.trim()).join('   |   ');
        return l.replace(/\*\*/g, '');
    }).join('\n');
}
