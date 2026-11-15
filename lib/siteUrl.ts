/** Returns the canonical public origin, or localhost only during local development. */
export function getSiteOrigin(): string | undefined {
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const value = configuredOrigin || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined);
    if (!value) return undefined;

    try {
        const url = new URL(value);
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        if (isLocalhost) return process.env.NODE_ENV === 'development' ? url.origin : undefined;
        if (url.protocol !== 'https:') return undefined;
        return url.origin;
    } catch {
        return undefined;
    }
}

export function getCanonicalUrl(path: string): string | undefined {
    const origin = getSiteOrigin();
    return origin ? new URL(path, `${origin}/`).toString() : undefined;
}
