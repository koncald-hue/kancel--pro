import { money, round2 } from './billing';
import { computeEnd, czDate } from './lhuty';
import { formatIban, toIban } from './qrPayment';
import { vypocetUroku, zakonnaSazba } from './urok';

// Upomínky: tři úrovně podle doby po splatnosti a odstupu od předchozí upomínky. Odesílání je na advokátovi (e-mail, tisk); evidence v invoice_reminders.
export type Level = 1 | 2 | 3;
export const LEVELS: Record<Level, { name: string; minAfterDue: number; minAfterPrev: number }> = {
    1: { name: 'Upomínka', minAfterDue: 3, minAfterPrev: 0 },
    2: { name: 'Opakovaná upomínka', minAfterDue: 14, minAfterPrev: 7 },
    3: { name: 'Předžalobní výzva', minAfterDue: 30, minAfterPrev: 10 },
};
export type Sent = { level: Level; sent_on: string };

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

// Která upomínka je na řadě: jen po splatnosti, po odstupu od splatnosti i od předchozí upomínky; poslední úroveň se neopakuje
export type NextReminder = { level: Level; overdueDays: number; ready: boolean; readyOn: string; last: Sent | null };
export function nextReminder(due: string | null, sent: Sent[], today: string): NextReminder | null {
    if (!due) return null;
    const overdue = dayDiff(due, today);
    if (overdue <= 0) return null;
    const last = [...sent].sort((a, b) => b.sent_on.localeCompare(a.sent_on) || b.level - a.level)[0] ?? null;
    const level = (last ? Math.min(3, last.level + 1) : 1) as Level;
    if (last && last.level === 3) return null;
    const cfg = LEVELS[level];
    const byDue = addIso(due, cfg.minAfterDue);
    const byPrev = last ? addIso(last.sent_on, cfg.minAfterPrev) : byDue;
    const readyOn = byDue > byPrev ? byDue : byPrev;
    return { level, overdueDays: overdue, ready: today >= readyOn, readyOn, last };
}
function addIso(iso: string, n: number) { return new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10); }

export type TextCtx = { level: Level; number: string; issue: string; due: string; outstanding: number; currency: 'CZK' | 'EUR'; account: string; vs: string; signature: string; today: string; lastSentOn?: string; client?: string };
export type Draft = { subject: string; body: string; interest: number; interestRate: number | null; deadline: string };

export function reminderText(c: TextCtx): Draft {
    const deadline = computeEnd(c.today, 7, 'den').end;
    const iban = toIban(c.account);
    const pay = `Platbu prosím zašlete na účet ${iban ? formatIban(iban) : c.account}${c.vs ? `, variabilní symbol ${c.vs}` : ''}.`;
    // Úrok z prodlení se počítá jen u korun, kde je v nařízení vlády č. 351/2013 Sb. zákonná sazba
    const info = c.currency === 'CZK' ? zakonnaSazba(c.due) : null;
    const calc = info ? vypocetUroku({ jistina: c.outstanding, splatnost: c.due, do: c.today, sazbaPct: info.rocni }) : null;
    const interest = calc ? calc.urok : 0;
    const rate = info ? info.rocni : null;
    const amount = money(c.outstanding, c.currency);
    const total = money(round2(c.outstanding + interest), c.currency);
    const rateText = rate === null ? '' : String(rate).replace('.', ',');
    const dl = czDate(deadline);
    const hello = 'Dobrý den,\n\n';
    const bye = `\n\nS pozdravem\n${c.signature}`;
    if (c.level === 1) return { interest, interestRate: rate, deadline, subject: `Upomínka k úhradě faktury č. ${c.number}`, body: `${hello}dovolujeme si Vás upozornit, že dosud nebyla zaznamenána úhrada faktury č. ${c.number} ze dne ${czDate(c.issue)}, splatné ${czDate(c.due)}. Dlužná částka činí ${amount}.\n\nPokud jste již platbu odeslali, považujte prosím tuto zprávu za bezpředmětnou. V opačném případě Vás žádáme o úhradu do ${dl}. ${pay}${bye}` };
    if (c.level === 2) return { interest, interestRate: rate, deadline, subject: `Opakovaná upomínka: faktura č. ${c.number}`, body: `${hello}faktura č. ${c.number} byla splatná ${czDate(c.due)} a navzdory předchozí upomínce${c.lastSentOn ? ` ze dne ${czDate(c.lastSentOn)}` : ''} nebyla uhrazena. Dlužná částka činí ${amount}.${rate !== null ? `\n\nPo splatnosti Vám vzniká povinnost platit úrok z prodlení. Podle nařízení vlády č. 351/2013 Sb. činí ${rateText} % ročně a ke dni ${czDate(c.today)} dosahuje ${money(interest, c.currency)}.` : ''}\n\nŽádáme o úhradu ${rate !== null ? `dlužné částky ${amount} spolu s úrokem` : 'dlužné částky'} do ${dl}. ${pay}${bye}` };
    return { interest, interestRate: rate, deadline, subject: `Předžalobní výzva k úhradě: faktura č. ${c.number}`, body: `${hello}vyzýváme Vás k úhradě dlužné částky z faktury č. ${c.number} ze dne ${czDate(c.issue)}, splatné ${czDate(c.due)}, ve výši ${amount}${rate !== null ? `, spolu s úrokem z prodlení ${money(interest, c.currency)} (${rateText} % ročně, ke dni ${czDate(c.today)}), celkem ${total}` : ''}. Úrok z prodlení dále narůstá až do zaplacení.\n\nNejpozději do ${dl} dluh uhraďte. ${pay}\n\nNebude-li dluh v této lhůtě uhrazen, budeme nuceni spis řešit soudní cestou. V takovém případě budeme požadovat také náhradu nákladů řízení. Tuto výzvu považujte za poslední před zahájením soudního řízení.${bye}` };
}

export const mailtoLink = (to: string, d: Draft) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
