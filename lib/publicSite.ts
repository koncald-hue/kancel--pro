// Adresa veřejného webu „Právo srozumitelně“ (přehled přestupků, kalkulačky, vzory). Odkazujeme na ni, ale aplikace s ní není propojená.
export const PUBLIC_SITE = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? 'https://pravo-srozumitelne.example').replace(/\/$/, '');
