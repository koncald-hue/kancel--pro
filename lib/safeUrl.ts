// Odkaz z dat (RSS, rejstříky, judikatura, profil) smí vést jen na http(s). Jinak undefined:
// adresa typu javascript:, data: nebo vbscript: by po kliknutí spustila kód v aplikaci.
export function safeUrl(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const v = raw.trim();
    if (!v || v.length > 2000) return undefined;
    try {
        const u = new URL(v);
        return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
    } catch { return undefined; }
}

// Webová adresa zadaná člověkem bez protokolu („www.kancelar.cz“) se doplní na https
export const safeWebsite = (raw: unknown): string | undefined => (typeof raw === 'string' && raw.trim() && !/^[a-z][a-z0-9+.-]*:/i.test(raw.trim()) ? safeUrl(`https://${raw.trim()}`) : safeUrl(raw));
