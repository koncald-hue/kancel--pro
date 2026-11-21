import { ImageResponse } from 'next/og';
import { LogoSvg } from '@/lib/logo';

// Ikona záložky prohlížeče a výsledků vyhledávání (Google chce čtverec s násobkem 48 px)
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f3556', borderRadius: 40 }}>
                <LogoSvg size={150} bare />
            </div>
        ),
        { ...size },
    );
}
