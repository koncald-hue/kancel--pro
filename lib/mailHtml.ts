// HTML podoba e-mailů z aplikace: značka Kanceláře Pro nahoře, text rozdělený do odstavců, odkazy klikací.
// Textová podoba se posílá vždy také, takže e-mail je čitelný i bez HTML.
const NAVY = '#16294a';
const GOLD = '#c9a24a';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (u) => `<a href="${u}" style="color:${NAVY};font-weight:bold">${u}</a>`);

export function htmlFromText(text: string, origin = 'https://kancelarpro.cz'): string {
    const body = text.trim().split(/\n{2,}/).map((p) => `<p style="font-size:15px;line-height:1.65;margin:0 0 16px;color:#1e293b">${linkify(esc(p)).replace(/\n/g, '<br>')}</p>`).join('');
    const base = origin.replace(/\/$/, '');
    return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f3ead6">
<div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;padding:28px 20px">
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px"><tr>
<td style="padding-right:12px"><img src="${base}/pwa-icon/stamp-128" width="48" height="48" alt="Kancelář Pro" style="display:block;border:0"></td>
<td style="font-size:20px;font-weight:bold;color:${NAVY}">Kancelář Pro</td></tr></table>
<div style="background:#ffffff;border-top:3px solid ${GOLD};padding:24px 22px;font-family:Arial,sans-serif">${body}</div>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#64748b;margin:16px 0 0">Kancelář Pro · pracovní prostor pro advokáty · <a href="${base}" style="color:#64748b">kancelarpro.cz</a></p>
</div></body></html>`;
}
