import { describe, expect, it } from 'vitest';
import { cleanOcr, IMAGE_RE, needsOcr, PDF_RE } from './pdfText';

describe('PDF a OCR', () => {
    it('strana bez textu je sken', () => { expect(needsOcr('   \n ')).toBe(true); expect(needsOcr('12 3')).toBe(true); expect(needsOcr('Smlouva o dílo mezi objednatelem a zhotovitelem.')).toBe(false); });
    it('typy souborů', () => { expect(PDF_RE.test('a.PDF')).toBe(true); expect(IMAGE_RE.test('sken.JPEG')).toBe(true); expect(IMAGE_RE.test('a.gif')).toBe(false); });
    it('čištění výstupu', () => { expect(cleanOcr('a\u0000  b\n\n\n\nc ')).toBe('a b\n\nc'); });
});
