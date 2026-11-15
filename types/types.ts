export interface TeamMember {
    id: number;
    name: string;
    role: string;
    faculty: string;
    bio?: string;
    photo_url?: string;
    created_at?: string;
}

export interface Article {
    id: number;
    slug: string;
    title: string;
    category: string;
    tags: string[];
    excerpt: string;
    content: string;
    authorName: string;
    authorPhoto?: string;
    authorRole: string;
    teamMemberId?: number | null;
    readTime: string;
    views: number;
    publishedAt: string;
    formattedDate: string;
}

export interface LegalDeadline {
    id: string;
    title: string;
    law: string;
    category: string;
    type: 'days' | 'months' | 'years' | 'months_next_first' | 'immediate';
    durationDays?: number;
    durationMonths?: number;
    durationYears?: number;
    description: string;
    startTrigger: string;
}

export interface NewArticleForm {
    title: string;
    category: string;
    excerpt: string;
    content: string;
    authorName: string;
    authorPhoto: string;
    authorRole: string;
    readTime: string;
    tagInput: string;
}

export interface NewMemberForm {
    name: string;
    role: string;
    faculty: string;
    bio: string;
    photo_url: string;
}
