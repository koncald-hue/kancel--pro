import { ImageResponse } from 'next/og';
import { LogoSvg } from '@/lib/logo';

// Ikony aplikace: any = běžná ikona, maskable = s ochrannou okrajem pro kruhové a zaoblené masky Androidu, apple = iPhone
const VARIANTS: Record<string, { size: number; pad: number; radius: number }> = {
    'any-192': { size: 192, pad: 0, radius: 40 },
    'any-512': { size: 512, pad: 0, radius: 110 },
    'maskable-512': { size: 512, pad: 0.18, radius: 0 },
    'apple-180': { size: 180, pad: 0, radius: 0 },
};

export async function GET(_req: Request, ctx: { params: Promise<{ variant: string }> }) {
    const name = (await ctx.params).variant;
    // Celé razítko se zlatým rámečkem pro e-maily a podobné místo, kde se nehodí jen písmeno
    if (name === 'stamp-128') return new ImageResponse(<LogoSvg size={128} />, { width: 128, height: 128, headers: { 'Cache-Control': 'public, max-age=86400' } });
    const v = VARIANTS[name];
    if (!v) return new Response('Not found', { status: 404 });
    const glyph = Math.round(v.size * (0.64 - v.pad));
    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f3556', borderRadius: v.radius }}>
                <LogoSvg size={glyph} bare />
            </div>
        ),
        { width: v.size, height: v.size, headers: { 'Cache-Control': 'public, max-age=86400' } },
    );
}
