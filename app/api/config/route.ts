import { NextResponse } from 'next/server';
import { mailConfigured } from '@/lib/mail';

// Co je na serveru nastavené (bez jakýchkoli hodnot klíčů): aplikace podle toho poctivě ukáže, co funguje
export function GET() {
    return NextResponse.json({ mail: mailConfigured() });
}
