import { beforeEach, describe, expect, it } from 'vitest';
import { cachedMessages, clearBoxState, newCount, searchCached, setReceived } from './dataBoxState';
import type { Record_ } from './isds';

const rec = (id: string, status: string, sender: string, annotation: string): Record_ => ({ id, sender, senderBox: '', recipient: '', recipientBox: '', annotation, status, delivered: '', accepted: '', attachmentSize: 0, undelivered: status === '4' });

describe('data box state', () => {
    beforeEach(() => clearBoxState());
    it('counts new (delivered, unread) messages across accounts', () => {
        setReceived('a', [rec('1', '4', 'Soud', 'x'), rec('2', '7', 'FÚ', 'y')]);
        setReceived('b', [rec('3', '6', 'ČSSZ', 'z'), rec('4', '9', 'Jiný', 'w')]);
        expect(newCount()).toBe(2);
        expect(cachedMessages()).toHaveLength(4);
    });
    it('searches loaded messages without diacritics', () => {
        setReceived('a', [rec('1', '7', 'Městský soud v Praze', 'Usnesení o nákladech'), rec('2', '7', 'FÚ', 'Výzva')]);
        expect(searchCached('mestsky').map((r) => r.id)).toEqual(['1']);
        expect(searchCached('vyzva').map((r) => r.id)).toEqual(['2']);
        expect(searchCached('x')).toEqual([]);
    });
});
