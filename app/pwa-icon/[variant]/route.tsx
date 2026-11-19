import { ImageResponse } from 'next/og';

// Ikony aplikace: any = běžná ikona, maskable = s ochrannou okrajem pro kruhové a zaoblené masky Androidu, apple = iPhone
const VARIANTS: Record<string, { size: number; pad: number; radius: number }> = {
    'any-192': { size: 192, pad: 0, radius: 40 },
    'any-512': { size: 512, pad: 0, radius: 110 },
    'maskable-512': { size: 512, pad: 0.18, radius: 0 },
    'apple-180': { size: 180, pad: 0, radius: 0 },
};

export async function GET(_req: Request, ctx: { params: Promise<{ variant: string }> }) {
    const v = VARIANTS[(await ctx.params).variant];
    if (!v) return new Response('Not found', { status: 404 });
    const glyph = Math.round(v.size * (0.64 - v.pad));
    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#4338ca', borderRadius: v.radius }}>
                <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" />
                    <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
                    <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
                    <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
                    <path d="M7 21h10" />
                </svg>
            </div>
        ),
        { width: v.size, height: v.size, headers: { 'Cache-Control': 'public, max-age=86400' } },
    );
}
