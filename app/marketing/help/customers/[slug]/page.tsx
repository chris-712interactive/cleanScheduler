import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HelpGuideArticle } from '@/components/marketing/HelpGuideArticle';
import { PRODUCT_NAME } from '@/lib/legal/site';
import {
  CUSTOMER_HELP_ARTICLES,
  CUSTOMER_HELP_HUB,
  getCustomerHelpArticle,
} from '@/lib/marketing/seoContent/customerHelpArticles';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return CUSTOMER_HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getCustomerHelpArticle(slug);
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

export default async function CustomerHelpGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getCustomerHelpArticle(slug);
  if (!article) notFound();

  return (
    <HelpGuideArticle
      article={article}
      hub={{
        backHref: CUSTOMER_HELP_HUB.path,
        backLabel: CUSTOMER_HELP_HUB.title,
        breadcrumbLabel: 'Customers',
      }}
      showTrialCta={false}
    />
  );
}
