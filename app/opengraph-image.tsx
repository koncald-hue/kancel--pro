import { ImageResponse } from 'next/og';

export const alt = 'Kancelář Pro, pracovní prostor pro advokáty';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Náhled při sdílení odkazu (zprávy, sítě): značka vlevo nahoře, velký titulek, tenká linka a adresa, vpravo znak váhy v kruzích
export default function OpengraphImage() {
    const scales = (
        <svg width={250} height={250} viewBox="0 0 24 24" fill="none" stroke="#f4f6fa" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18" />
            <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
            <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
            <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
            <path d="M7 21h10" />
        </svg>
    );
    return new ImageResponse(
        (
            <div style={{ display: 'flex', width: '100%', height: '100%', background: 'radial-gradient(circle at 78% 45%, #2a4a78 0%, #0f1d33 70%)', color: '#f4f6fa', position: 'relative' }}>
                <div style={{ position: 'absolute', right: 70, top: 65, width: 500, height: 500, borderRadius: 250, border: '2px solid #b6c3d6', opacity: 0.55, display: 'flex' }} />
                <div style={{ position: 'absolute', right: 96, top: 91, width: 448, height: 448, borderRadius: 224, border: '1px solid #b6c3d6', opacity: 0.35, display: 'flex' }} />
                <div style={{ position: 'absolute', right: 70, top: 65, width: 500, height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{scales}</div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', width: 740 }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 700, letterSpacing: 1, color: '#b6c3d6' }}>KANCELÁŘ PRO</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', fontSize: 78, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1 }}>Všechna vaše práce na jednom místě.</div>
                        <div style={{ display: 'flex', fontSize: 31, lineHeight: 1.35, color: '#c9d4e4', marginTop: 28 }}>Spisy, lhůty, klienti a faktury advokáta. 14 dní zdarma, bez platební karty.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', width: 64, height: 3, background: '#b6c3d6', marginRight: 20 }} />
                        <div style={{ display: 'flex', fontSize: 28, color: '#c9d4e4' }}>kancelarpro.cz</div>
                    </div>
                </div>
            </div>
        ),
        { ...size },
    );
}
