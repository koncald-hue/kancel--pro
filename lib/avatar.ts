// Fotka profilu: v prohlížeči se ořízne na čtverec a zmenší na miniaturu a větší verzi (JPEG, bez metadat).
export const AVATAR_SMALL = 64;
export const AVATAR_LARGE = 320;
export const MAX_AVATAR_FILE = 8 * 1024 * 1024;

export const initialsOf = (name: string) => name.split(/\s+/).filter((p) => /\p{L}/u.test(p)).slice(0, 2).map((p) => (p.match(/\p{L}/u)?.[0] ?? '').toUpperCase()).join('') || '?';

async function loadImage(file: File): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(file);
    try {
        return await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Soubor se nepodařilo načíst jako obrázek.')); img.src = url; });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

function squareJpeg(img: HTMLImageElement, size: number, quality: number): string {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Prohlížeč neumí zpracovat obrázek.');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
}

export async function prepareAvatar(file: File): Promise<{ small: string; large: string }> {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Použijte obrázek JPG, PNG nebo WebP.');
    if (file.size > MAX_AVATAR_FILE) throw new Error('Obrázek je větší než 8 MB.');
    const img = await loadImage(file);
    if (img.naturalWidth < 32 || img.naturalHeight < 32) throw new Error('Obrázek je příliš malý.');
    let large = squareJpeg(img, AVATAR_LARGE, 0.82);
    if (large.length > 140_000) large = squareJpeg(img, AVATAR_LARGE, 0.6);
    return { small: squareJpeg(img, AVATAR_SMALL, 0.8), large };
}
