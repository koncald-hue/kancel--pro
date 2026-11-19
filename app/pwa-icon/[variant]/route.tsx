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
    const glyph = Math.round(v.size * (0.62 - v.pad));
    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#4338ca', borderRadius: v.radius }}>
                <div style={{ display: 'flex', fontSize: glyph, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>K</div>
            </div>
        ),
        { width: v.size, height: v.size, headers: { 'Cache-Control': 'public, max-age=86400' } },
    );
}
