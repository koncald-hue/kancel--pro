import { ImageResponse } from 'next/og';

export const alt = 'Kancelář, pracovní prostor pro advokáty';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Náhled při sdílení odkazu (zprávy, sítě)
export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', padding: 80, background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)', color: 'white' }}>
                <div style={{ fontSize: 34, color: '#c7d2fe', fontWeight: 600 }}>Kancelář · pracovní prostor pro advokáty</div>
                <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>Všechna vaše práce na jednom místě.</div>
                <div style={{ fontSize: 36, color: '#e0e7ff', marginTop: 36 }}>Spisy, lhůty, klienti a faktury. Od 649 Kč měsíčně.</div>
            </div>
        ),
        { ...size },
    );
}
