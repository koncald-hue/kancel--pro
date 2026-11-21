// Značka Kancelář Pro: serifové K v krémové barvě na tmavě modré, ve zlatém rámečku jako razítko kanceláře.
// Jediný zdroj tvaru pro aplikaci, ikony záložky a aplikace, náhled odkazu i doplněk do Wordu.
export const LOGO_NAVY = '#16294a';
export const LOGO_GOLD = '#c9a24a';
export const LOGO_INK = '#f3ead6';
export const LOGO_K = 'M16 14h15v2.4h-3.2v13.2L40.2 14.4H37V14h12v.4h-2.6L33.6 29.8 48.6 47.6H51V50H38.4v-2.4h2L29.3 34.4l-1.5 1.8v11.4h3.2V50H16v-2.4h3.2V16.4H16z';

// bare = jen písmeno (pro podklad, který určuje volající); jinak celé razítko včetně rámečku
export function LogoSvg({ size = 32, radius = 12, bare = false, ink = LOGO_INK, label }: { size?: number; radius?: number; bare?: boolean; ink?: string; label?: string }) {
    return (
        <svg width={size} height={size} viewBox={bare ? '12 10 43 44' : '0 0 64 64'} xmlns="http://www.w3.org/2000/svg" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
            {!bare && <rect width="64" height="64" rx={radius / 4} fill={LOGO_NAVY} />}
            {!bare && <rect x="3.5" y="3.5" width="57" height="57" fill="none" stroke={LOGO_GOLD} strokeWidth="1" />}
            <path fill={ink} d={LOGO_K} />
        </svg>
    );
}

// Textová podoba pro generování PNG mimo React (doplněk do Wordu)
export const LOGO_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="3" fill="${LOGO_NAVY}"/><rect x="3.5" y="3.5" width="57" height="57" fill="none" stroke="${LOGO_GOLD}" stroke-width="1"/><path fill="${LOGO_INK}" d="${LOGO_K}"/></svg>`;
