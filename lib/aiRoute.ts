// Návrh věci pro e-mail pomocí AI, když pravidla (klient, spisová značka, doména) nestačí.
// Odesílá se jen výňatek e-mailu a názvy otevřených věcí; identifikátory zakrývá redact() v prohlížeči i na serveru.
export const ROUTE_MAX_CASES = 40;
export type RouteCase = { id: string; title: string };

export function buildRoutePrompt(mail: { subject: string; text: string }, cases: RouteCase[]): { text: string; list: RouteCase[] } {
    const list = cases.slice(0, ROUTE_MAX_CASES);
    const text = `E-MAIL\nPředmět: ${mail.subject.slice(0, 200)}\n${mail.text.slice(0, 2500)}\n\nVĚCI\n${list.map((c, i) => `${i + 1}. ${c.title.slice(0, 120)}`).join('\n')}`;
    return { text, list };
}

// Odpověď modelu: číslo věci (0 = žádná) a krátké odůvodnění. Cokoli mimo seznam se odmítne.
export function parseRoute(answer: string, count: number): { index: number | null; reason: string } {
    const m = answer.match(/\{[\s\S]*\}/);
    if (!m) return { index: null, reason: '' };
    try {
        const j = JSON.parse(m[0]) as { vec?: unknown; duvod?: unknown };
        const n = Number(j.vec);
        const reason = typeof j.duvod === 'string' ? j.duvod.slice(0, 200) : '';
        return Number.isInteger(n) && n >= 1 && n <= count ? { index: n - 1, reason } : { index: null, reason };
    } catch { return { index: null, reason: '' }; }
}
