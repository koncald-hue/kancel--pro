// Převede text na část adresy: malá písmena, bez diakritiky, mezery jako pomlčky
export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

// Část adresy detailu přestupku / trestného činu, např. "1-vrazda"
export function getOffenseSlug(id: string, title: string): string {
    return `${id}-${slugify(title)}`;
}

export function getOffenseUrl(id: string, title: string): string {
    return `/prestupky-a-trestne-ciny/${getOffenseSlug(id, title)}`;
}

// Adresa článku, např. "/clanky/12-vypoved-z-najmu". Číslo na začátku je ID článku v databázi,
// takže odkaz funguje i po přejmenování článku a dva články se stejným názvem se nepletou.
export function getArticleUrl(id: number, title: string): string {
    const slug = slugify(title).replace(/-{2,}/g, "-") || "clanek";
    return `/clanky/${id}-${slug}`;
}

// Z části adresy "12-vypoved-z-najmu" vrátí ID 12 (nebo null, když tam číslo není)
export function parseLeadingId(segment: string): number | null {
    const match = segment.match(/^(\d+)(?:-|$)/);
    return match ? Number(match[1]) : null;
}
