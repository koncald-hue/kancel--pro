// Značka Kancelář Pro: písmeno K postavené jako hřbet spisu s ramenem, které končí pečetí (zlatá tečka).
// Jediný zdroj tvaru pro aplikaci, ikony záložky a aplikace, náhled odkazu i doplněk do Wordu.
export const LOGO_NAVY = '#1f3556';
export const LOGO_SEAL = '#e3a93c';

export function LogoSvg({ size = 32, radius = 14, bare = false, ink = '#ffffff', label }: { size?: number; radius?: number; bare?: boolean; ink?: string; label?: string }) {
    return (
        <svg width={size} height={size} viewBox={bare ? '9 9 46 46' : '0 0 64 64'} xmlns="http://www.w3.org/2000/svg" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
            {!bare && <rect width="64" height="64" rx={radius} fill={LOGO_NAVY} />}
            <g fill="none" stroke={ink} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v34" />
                <path d="M24 35l15-15" />
                <path d="M30 30l13 19" />
            </g>
            <circle cx="44" cy="17" r="5.5" fill={LOGO_SEAL} />
        </svg>
    );
}

// Textová podoba pro generování PNG mimo React (doplněk do Wordu)
export const LOGO_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${LOGO_NAVY}"/><g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v34"/><path d="M24 35l15-15"/><path d="M30 30l13 19"/></g><circle cx="44" cy="17" r="5.5" fill="${LOGO_SEAL}"/></svg>`;
