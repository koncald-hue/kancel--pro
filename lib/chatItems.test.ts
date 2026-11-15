import { describe, expect, it } from 'vitest';
import { KIND_LABELS, previewText } from './chatItems';

describe('chat items', () => {
    it('summarizes every kind of message for the conversation list', () => {
        expect(previewText({ v: 1, kind: 'text', text: 'Ahoj, máš chvíli?' })).toBe('Ahoj, máš chvíli?');
        expect(previewText({ v: 1, kind: 'file', note: '', files: [{ name: 'žaloba.pdf', size: 1, mime: '', i: 0, folder: '' }] })).toBe('Soubor: žaloba.pdf');
        expect(previewText({ v: 1, kind: 'client', note: '', client: { name: 'Petr Klient', email: '', phone: '', address: '', ico: '', dic: '', note: '' } })).toBe('Klient: Petr Klient');
        expect(Object.keys(KIND_LABELS)).toEqual(['text', 'file', 'case', 'client', 'property']);
    });
});
