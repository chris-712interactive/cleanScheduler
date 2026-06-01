import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HelpGuideArticle } from '@/components/marketing/HelpGuideArticle';
import { PRODUCT_NAME } from '@/lib/legal/site';
import { CLEANING_BUSINESS_ARTICLES, getCleaningBusinessArticle } from '@/lib/marketing/seoContent';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return CLEANING_BUSINESS_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getCleaningBusinessArticle(slug);
  if (!article) return { title: PRODUCT_NAME };

  return {
    title: `${article.title} | ${PRODUCT_NAME}`,
    description: article.description,
    alternates: { canonical: article.path },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
    },
  };
}

export default async function CleaningBusinessGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getCleaningBusinessArticle(slug);
  if (!article) notFound();
  return <HelpGuideArticle article={article} />;
}
