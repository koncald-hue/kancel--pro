import { NextResponse } from 'next/server';
import { mailConfigured, sendMail } from '@/lib/mail';

// Zpráva od návštěvníka nebo zákazníka („Napište nám“, v aplikaci „Nahlásit problém“). Jde e-mailem správci (ADMIN_NOTIFY_EMAIL)
// s adresou pro odpověď nastavenou na zákazníka, takže stačí v poště kliknout na Odpovědět.
const isEmail = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
export async function POST(req: Request) {
    const b = await req.json().catch(() => null) as { email?: string; name?: string; message?: string; page?: string; kind?: string; website?: string } | null;
    if (b?.website) return NextResponse.json({ ok: true });
    const email = String(b?.email ?? '').trim();
    const name = String(b?.name ?? '').trim().slice(0, 100);
    const message = String(b?.message ?? '').trim();
    const page = String(b?.page ?? '').slice(0, 200);
    const kind = String(b?.kind ?? '').slice(0, 40);
    if (!isEmail(email)) return NextResponse.json({ error: 'Zadejte platný e-mail, ať vám můžeme odpovědět.' }, { status: 400 });
    if (message.length < 5 || message.length > 3000) return NextResponse.json({ error: 'Zpráva musí mít 5 až 3000 znaků.' }, { status: 400 });
    const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
    if (!to || !mailConfigured()) return NextResponse.json({ error: 'Formulář teď nejde odeslat. Napište nám prosím e-mail.' }, { status: 503 });
    const text = ['Nová zpráva pro podporu Kanceláře Pro', '', `Od: ${name ? `${name} ` : ''}<${email}>`, kind ? `Druh: ${kind}` : '', page ? `Stránka: ${page}` : '', '', message, '', 'Odpovězte přímo na tento e-mail, odpověď půjde zákazníkovi.'].join('\n');
    try { await sendMail(to, `Kancelář Pro: zpráva od ${name || email}`, text, fetch, [], email); return NextResponse.json({ ok: true }); }
    catch { return NextResponse.json({ error: 'Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.' }, { status: 502 }); }
}
