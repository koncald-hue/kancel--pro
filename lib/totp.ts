import { createHmac } from 'node:crypto';

// TOTP podle RFC 6238 (SHA-1, 6 číslic, 30 s). V aplikaci kód ověřuje Supabase; tohle slouží testům a kontrolnímu skriptu.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Decode(s: string): Buffer {
    let bits = 0, value = 0; const out: number[] = [];
    for (const ch of s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')) { const i = B32.indexOf(ch); if (i < 0) throw new Error('Neplatný znak v klíči'); value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
    return Buffer.from(out);
}
export function totp(secretBase32: string, atMs = Date.now(), digits = 6, stepSec = 30): string {
    const counter = Math.floor(atMs / 1000 / stepSec);
    const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
    const h = createHmac('sha1', base32Decode(secretBase32)).update(buf).digest();
    const o = h[h.length - 1] & 15;
    const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(code % 10 ** digits).padStart(digits, '0');
}
