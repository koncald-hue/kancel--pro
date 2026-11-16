import { initialsOf } from '@/lib/avatar';

// Kulatá fotka profilu; bez fotky se ukážou iniciály.
export default function Avatar({ name, src, size = 36, className = '' }: { name: string; src?: string; size?: number; className?: string }) {
    const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
    if (src && src.startsWith('data:image/jpeg;base64,')) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt="" aria-hidden="true" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />;
    }
    return <span aria-hidden="true" style={style} className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-900 ${className}`}>{initialsOf(name)}</span>;
}
