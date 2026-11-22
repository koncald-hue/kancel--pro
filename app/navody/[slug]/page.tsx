import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import GuideArticle from '@/app/components/seo/GuideArticle';
import { GUIDES, guideBySlug } from '@/lib/seo/guides';

export function generateStaticParams() {
    return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<'/navody/[slug]'>): Promise<Metadata> {
    const g = guideBySlug((await params).slug);
    if (!g) return {};
    const url = `/navody/${g.slug}`;
    return {
        title: `${g.title} | Kancelář Pro`,
        description: g.description,
        alternates: { canonical: url },
        openGraph: { type: 'article', locale: 'cs_CZ', siteName: 'Kancelář Pro', title: g.title, description: g.description, url, publishedTime: g.published, modifiedTime: g.updated },
    };
}

// Parametr se čte uvnitř <Suspense>: známé články jsou předgenerované celé, navigace zůstává okamžitá
export default function Page({ params }: PageProps<'/navody/[slug]'>) {
    return <Suspense fallback={null}><Article params={params} /></Suspense>;
}

async function Article({ params }: { params: Promise<{ slug: string }> }) {
    const g = guideBySlug((await params).slug);
    if (!g) notFound();
    return <GuideArticle guide={g} />;
}
