// Katalog advokátů na Studuj právo: obory, kraje a kontrola poptávky, která odtud přijde.
// Bez databáze a prohlížeče, aby šlo vše testovat. Stejné číselníky používá i studujpravo.cz.

export const DIRECTORY_AREAS = [
    { id: 'obcanske-pravo', label: 'Smlouvy, dluhy a náhrada škody' },
    { id: 'bydleni', label: 'Bydlení a nájem' },
    { id: 'prace', label: 'Pracovní právo' },
    { id: 'spotrebitel', label: 'Spotřebitel a reklamace' },
    { id: 'rodina', label: 'Rodina, rozvod a dědictví' },
    { id: 'urady', label: 'Úřady a přestupky' },
    { id: 'trestni-pravo', label: 'Trestní právo' },
    { id: 'obchodni-pravo', label: 'Podnikání a firmy' },
] as const;
export type DirectoryArea = (typeof DIRECTORY_AREAS)[number]['id'];

export const DIRECTORY_REGIONS = [
    'Hlavní město Praha', 'Středočeský kraj', 'Jihočeský kraj', 'Plzeňský kraj', 'Karlovarský kraj',
    'Ústecký kraj', 'Liberecký kraj', 'Královéhradecký kraj', 'Pardubický kraj', 'Kraj Vysočina',
    'Jihomoravský kraj', 'Olomoucký kraj', 'Zlínský kraj', 'Moravskoslezský kraj',
] as const;

export const AREA_LABELS: Record<string, string> = Object.fromEntries(DIRECTORY_AREAS.map((a) => [a.id, a.label]));
export const isArea = (v: unknown): v is DirectoryArea => typeof v === 'string' && v in AREA_LABELS;
export const isRegion = (v: unknown): v is string => typeof v === 'string' && (DIRECTORY_REGIONS as readonly string[]).includes(v);

/** Kolik dní má advokát na odpověď, než poptávka vyprší a člověk dostane nabídku vybrat jiného. */
export const PARTNER_REPLY_DAYS = 5;

/** Odkud smí přijít poptávka z katalogu (prohlížeč na studujpravo.cz). */
export function partnerOrigins(): string[] {
    const env = process.env.PARTNER_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
    return env?.length ? env : ['https://studujpravo.cz', 'https://www.studujpravo.cz'];
}
export function corsHeaders(origin: string | null): Record<string, string> {
    const allowed = origin && partnerOrigins().includes(origin) ? origin : partnerOrigins()[0];
    return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}

export type PartnerInquiry = { directoryId: string; name: string; email: string; phone: string; message: string; area: DirectoryArea | null; region: string | null; district: string; ref: string | null };

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kontrola poptávky z katalogu. Souhlas s předáním údajů advokátovi je povinný. */
export function validatePartnerInquiry(body: Record<string, unknown>): { ok: true; value: PartnerInquiry } | { ok: false; field: string } {
    const directoryId = clean(body.lawyer, 40);
    const name = clean(body.name, 120);
    const email = clean(body.email, 160);
    const phone = clean(body.phone, 40);
    const message = clean(body.message, 3000);
    const ref = clean(body.ref, 64);
    if (!UUID.test(directoryId)) return { ok: false, field: 'lawyer' };
    if (name.length < 2) return { ok: false, field: 'name' };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, field: 'email' };
    if (!email && phone.replace(/\D/g, '').length < 9) return { ok: false, field: 'email' };
    if (message.length < 20) return { ok: false, field: 'message' };
    if (body.consent !== true) return { ok: false, field: 'consent' };
    if (ref && !/^[A-Za-z0-9_-]{16,64}$/.test(ref)) return { ok: false, field: 'ref' };
    return { ok: true, value: { directoryId, name, email, phone, message, area: isArea(body.area) ? body.area : null, region: isRegion(body.region) ? body.region : null, district: clean(body.district, 60), ref: ref || null } };
}

export type DirectoryRow = { directory_id: string; display_name: string | null; register_name: string | null; bar_number: string | null; office: string | null; profession: string | null; directory_areas: string[] | null; directory_regions: string[] | null; directory_consult: string | null; directory_bio: string | null; avatar_small: string | null; website: string | null };
export type DirectoryLawyer = { id: string; name: string; bar: string; city: string; areas: string[]; regions: string[]; consult: string; bio: string; photo: string | null; website: string };

/** Z adresy kanceláře vezme město (poslední část za čárkou, bez PSČ). */
export function cityOf(office: string): string {
    const parts = office.split(',').map((s) => s.trim()).filter(Boolean);
    const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '';
    return last.replace(/\b\d{3}\s?\d{2}\b/, '').trim();
}

export function toDirectoryLawyer(r: DirectoryRow): DirectoryLawyer {
    const photo = r.avatar_small && /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(r.avatar_small) ? r.avatar_small : null;
    return {
        id: r.directory_id,
        name: (r.display_name || r.register_name || '').trim(),
        bar: r.profession === 'advokat' ? (r.bar_number ?? '').trim() : '',
        city: cityOf(r.office ?? ''),
        areas: (r.directory_areas ?? []).filter(isArea),
        regions: (r.directory_regions ?? []).filter(isRegion),
        consult: (r.directory_consult ?? '').trim(),
        bio: (r.directory_bio ?? '').trim(),
        photo,
        website: (r.website ?? '').trim(),
    };
}

/** E-mail člověku, když advokát poptávku přijme, odmítne nebo nestihne odpovědět. */
export function decisionMail(kind: 'accepted' | 'declined' | 'expired', o: { clientName: string; lawyerName: string; lawyerEmail: string; lawyerPhone: string; catalogUrl: string }): { subject: string; text: string } {
    const hi = `Dobrý den, ${o.clientName},`;
    const sign = ['', 'Studuj právo (zprávu odeslala aplikace Kancelář Pro)'];
    if (kind === 'accepted') {
        const contact = [o.lawyerEmail, o.lawyerPhone].filter(Boolean).join(', ');
        return { subject: `Advokát ${o.lawyerName} přijal vaši poptávku`, text: [hi, '', `advokát ${o.lawyerName} si vaši poptávku přečetl a ozve se vám.`, ...(contact ? [`Kontakt: ${contact}`] : []), '', 'Cenu a další postup si domluvíte přímo s advokátem. Studuj právo ani Kancelář Pro za zprostředkování nic neúčtují.', ...sign].join('\n') };
    }
    const why = kind === 'declined' ? `advokát ${o.lawyerName} vaši věc bohužel nemůže převzít (nejčastěji kvůli kapacitě nebo oboru).` : `advokát ${o.lawyerName} na vaši poptávku do ${PARTNER_REPLY_DAYS} dnů neodpověděl.`;
    return { subject: kind === 'declined' ? 'Advokát nemůže vaši věc převzít' : 'Advokát zatím neodpověděl', text: [hi, '', why, '', `Můžete si vybrat jiného advokáta: ${o.catalogUrl}`, '', 'Pokud vám běží lhůta, neotálejte.', ...sign].join('\n') };
}
