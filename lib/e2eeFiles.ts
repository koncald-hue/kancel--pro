import { supabase } from './supabase';
import { decryptBytes, decryptToBlob } from './e2ee';

// Stažení a dešifrování souboru z úložiště advokáta (soubor je v úložišti jen zašifrovaný)
export async function fetchDecrypted(path: string, key: CryptoKey): Promise<Uint8Array> {
    const { data, error } = await supabase.storage.from('case-files').download(path);
    if (error || !data) throw new Error(error?.message ?? 'Soubor se nepodařilo stáhnout.');
    return decryptBytes(key, new Uint8Array(await data.arrayBuffer()));
}

export async function saveEncryptedFile(path: string, key: CryptoKey, name: string) {
    const { data, error } = await supabase.storage.from('case-files').download(path);
    if (error || !data) throw new Error(error?.message ?? 'Soubor se nepodařilo stáhnout.');
    const blob = await decryptToBlob(key, new Uint8Array(await data.arrayBuffer()), name);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
