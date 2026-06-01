import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoMarketingPage } from '@/components/marketing/SeoMarketingPage';
import { PRODUCT_NAME } from '@/lib/legal/site';
import {
  COMPARE_PAGES,
  buildPageMetadata,
  getSeoMarketingPageBySlug,
} from '@/lib/marketing/seoContent';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return COMPARE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoMarketingPageBySlug('compare', slug);
  if (!page) return { title: PRODUCT_NAME };
  const meta = buildPageMetadata(page);
  return { ...meta, title: `${meta.title} | ${PRODUCT_NAME}` };
}

export default async function CompareSegmentPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getSeoMarketingPageBySlug('compare', slug);
  if (!page) notFound();
  return <SeoMarketingPage page={page} />;
}
