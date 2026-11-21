// HTML podoba e-mailů z aplikace: tmavě modré záhlaví se značkou, bílá karta se zlatou linkou, tlačítko u odkazu,
// zvýrazněný kód a patička. Textová podoba se posílá vždy také, takže e-mail je čitelný i bez HTML.
// Rozložení je z tabulek s inline styly, aby se stejně zobrazilo v Outlooku, Gmailu i Apple Mailu.
const NAVY = '#16294a';
const GOLD = '#c9a24a';
const INK = '#1e293b';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (u) => `<a href="${u}" style="color:${NAVY};font-weight:bold">${u}</a>`);
const P = `font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;margin:0 0 16px;color:${INK}`;

// Samostatný odkaz na řádku se změní na tlačítko
function button(url: string, base: string): string {
    const own = url.startsWith(base);
    const label = own ? 'Otevřít v Kanceláři Pro' : 'Otevřít odkaz';
    return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 22px"><tr><td style="background:${NAVY};border-bottom:3px solid ${GOLD}"><a href="${url}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${label}</a></td></tr></table>`;
}

// Kód na konci věty („… je: 123456“) se zvýrazní vlastním rámečkem
function codeBox(code: string): string {
    return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 20px"><tr><td style="background:#f3ead6;border:1px solid ${GOLD};padding:14px 26px;font-family:'Courier New',monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:${NAVY}">${code}</td></tr></table>`;
}

export function htmlFromText(text: string, origin = 'https://kancelarpro.cz'): string {
    const base = origin.replace(/\/$/, '');
    const paras = text.trim().split(/\n{2,}/);
    const preheader = esc((paras.find((p) => !/^(Dobrý den|Dobrý večer)/i.test(p.trim()) && !/^https?:\/\//.test(p.trim())) ?? '').replace(/\s+/g, ' ').slice(0, 110));
    const body = paras.map((raw) => {
        const p = raw.trim();
        if (/^https?:\/\/\S+$/.test(p)) return button(p, base);
        const code = p.match(/^([\s\S]*?:)\s*(\d{4,8})$/);
        if (code) return `<p style="${P}">${esc(code[1])}</p>${codeBox(code[2])}`;
        return `<p style="${P}">${linkify(esc(p)).replace(/\n/g, '<br>')}</p>`;
    }).join('');
    return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"></head><body style="margin:0;padding:0;background:#f3ead6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3ead6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px">
<tr><td style="background:${NAVY};padding:20px 26px;border-bottom:3px solid ${GOLD}"><table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td style="padding-right:14px"><img src="${base}/pwa-icon/stamp-128" width="44" height="44" alt="" style="display:block;border:0"></td>
<td style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:bold;letter-spacing:3px;color:#f3ead6">KANCELÁŘ PRO</td></tr></table></td></tr>
<tr><td style="background:#ffffff;padding:30px 28px 14px">${body}</td></tr>
<tr><td style="padding:18px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b">Tuto zprávu vám odeslala Kancelář Pro, pracovní prostor pro advokáty. Pokud jste ji nečekali, můžete ji ignorovat.<br><a href="${base}" style="color:#64748b">kancelarpro.cz</a></td></tr>
</table></td></tr></table></body></html>`;
}
