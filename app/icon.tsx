import { ImageResponse } from 'next/og';

// Ikona záložky prohlížeče a výsledků vyhledávání (Google chce čtverec s násobkem 48 px)
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f3556', borderRadius: 40 }}>
                <svg width={123} height={123} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" />
                    <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
                    <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
                    <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
                    <path d="M7 21h10" />
                </svg>
            </div>
        ),
        { ...size },
    );
}
